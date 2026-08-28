import React from "react";

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  background: "#f5f6f8",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const numberInputStyle = {
  ...inputStyle,
  textAlign: "center",
};

const labelStyle = {
  color: "#2563eb",
  fontWeight: 600,
};

const responseOptionHeaderTextStyle = {
  padding: "0 12px",
};

const normalizeQuestionTypeDescription = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isSignatureAgreementQuestionType = (questionTypeId, description) =>
  Number(questionTypeId) === 33 ||
  normalizeQuestionTypeDescription(description) === "signature_agreement";

const normalizeChoiceCategoryValue = (value) => String(value ?? "").trim();

const normalizeChoiceForEditing = (choice = {}, fallbackOrder = 0) => ({
  ...choice,
  option: String(choice?.option ?? ""),
  option_more_info: String(choice?.option_more_info ?? ""),
  category: normalizeChoiceCategoryValue(choice?.category),
  report_verbiage: String(choice?.report_verbiage ?? ""),
  value: Number(choice?.value ?? 0),
  order: Number(choice?.order ?? fallbackOrder),
});

export default function QuestionTranslationFields({
  isOpen,
  editingQuestion,
  setEditingQuestion,
  selectedQuestionType,
  editableFields,
  forceChoicesJson = false,
  forceHyperlinkField = false,
}) {
  const optionInputRefs = React.useRef({});
  const nextOptionFocusIndexRef = React.useRef(null);
  const choicesLength = editingQuestion?.choices?.length ?? 0;
  const editableFieldSet = React.useMemo(
    () => new Set(Array.isArray(editableFields) ? editableFields : []),
    [editableFields]
  );

  React.useEffect(() => {
    if (!isOpen || !editingQuestion) return;

    const nextIndex = nextOptionFocusIndexRef.current;
    if (nextIndex === null || nextIndex === undefined) return;

    const input = optionInputRefs.current[nextIndex];
    if (input) {
      input.focus();
      input.select?.();
    }

    nextOptionFocusIndexRef.current = null;
  }, [isOpen, editingQuestion, choicesLength]);

  if (!editingQuestion) {
    return null;
  }

  const isPerformTaskVideo =
    normalizeQuestionTypeDescription(selectedQuestionType?.description) ===
    "perform_task_video";
  const isSignatureAgreement = isSignatureAgreementQuestionType(
    editingQuestion.question_type_id,
    selectedQuestionType?.description
  );
  const normalizedChoices = Array.isArray(editingQuestion.choices)
    ? editingQuestion.choices.map((choice, index) => normalizeChoiceForEditing(choice, index + 1))
    : [];
  const signatureAgreementChoicesJson =
    typeof editingQuestion.choices_json === "string"
      ? editingQuestion.choices_json
      : JSON.stringify(editingQuestion.choices ?? [], null, 2);
  const sortedChoices = [...normalizedChoices].sort((a, b) => a.order - b.order);
  const longestOptionLength = sortedChoices.reduce(
    (maxLength, choice) => Math.max(maxLength, String(choice?.option ?? "").length),
    "Option".length
  );
  const optionColumnWidth = `${Math.max(Math.round((longestOptionLength + 2) * 0.85), 10)}ch`;
  const responseOptionGridTemplateColumns = `${optionColumnWidth} minmax(220px, 1fr) 90px 90px 40px`;
  const showTitle = editableFieldSet.has("title");
  const showQuestion = editableFieldSet.has("question");
  const showHyperlink =
    editableFieldSet.has("hyperlink") &&
    (forceHyperlinkField || isPerformTaskVideo || isSignatureAgreement);
  const showChoices = editableFieldSet.has("choices");
  const showActive = editableFieldSet.has("is_active");

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {showTitle && (
        <div>
          <label style={labelStyle}>Title</label>
          <input
            style={inputStyle}
            value={editingQuestion.title ?? ""}
            onChange={(e) =>
              setEditingQuestion({ ...editingQuestion, title: e.target.value })
            }
          />
        </div>
      )}

      {showQuestion && (
        <div>
          <label style={labelStyle}>Question Verbiage</label>
          <textarea
            rows={3}
            style={inputStyle}
            value={editingQuestion.question ?? ""}
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                question: e.target.value,
              })
            }
          />
        </div>
      )}

      {showHyperlink && (
        <div>
          <label style={labelStyle}>
            {isSignatureAgreement ? "Document URL (PDF)" : "Hyperlink"}
          </label>
          <input
            style={inputStyle}
            placeholder={
              isSignatureAgreement
                ? "https://.../agreement.pdf"
                : "https://..."
            }
            value={editingQuestion.hyperlink ?? ""}
            onChange={(e) =>
              setEditingQuestion({
                ...editingQuestion,
                hyperlink: e.target.value,
              })
            }
          />
        </div>
      )}

      {showChoices && (
        <div>
          <div
            style={{
              fontWeight: 600,
              marginBottom: "8px",
              color: "#2563eb",
            }}
          >
            {forceChoicesJson || isSignatureAgreement ? "Response JSON" : "Response Options"}
          </div>

          {forceChoicesJson || isSignatureAgreement ? (
            <textarea
              rows={12}
              style={{
                ...inputStyle,
                fontFamily: "Consolas, 'Courier New', monospace",
                whiteSpace: "pre",
                resize: "vertical",
              }}
              value={signatureAgreementChoicesJson}
              onChange={(e) =>
                setEditingQuestion({
                  ...editingQuestion,
                  choices_json: e.target.value,
                })
              }
            />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: responseOptionGridTemplateColumns,
                  columnGap: "8px",
                  rowGap: "8px",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    ...responseOptionHeaderTextStyle,
                    fontSize: "0.8rem",
                    color: "#666",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                  }}
                >
                  Option
                </div>
                <div
                  style={{
                    ...responseOptionHeaderTextStyle,
                    fontSize: "0.8rem",
                    color: "#666",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                  }}
                >
                  Category
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#666",
                    textAlign: "center",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                  }}
                >
                  Value
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#666",
                    textAlign: "center",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                  }}
                >
                  Order
                </div>
                <div />

                {sortedChoices.map((choice, idx) => {
                  const originalIndex = normalizedChoices.indexOf(choice);

                  return (
                    <React.Fragment key={`translation-choice-${originalIndex}-${idx}`}>
                      <input
                        ref={(element) => {
                          if (element) {
                            optionInputRefs.current[originalIndex] = element;
                          } else {
                            delete optionInputRefs.current[originalIndex];
                          }
                        }}
                        style={inputStyle}
                        value={choice.option}
                        onChange={(e) => {
                          const nextChoices = [...normalizedChoices];
                          nextChoices[originalIndex] = {
                            ...nextChoices[originalIndex],
                            option: e.target.value,
                          };
                          setEditingQuestion({ ...editingQuestion, choices: nextChoices });
                        }}
                      />

                      <input
                        style={inputStyle}
                        value={normalizeChoiceCategoryValue(choice.category)}
                        onChange={(e) => {
                          const nextChoices = [...normalizedChoices];
                          nextChoices[originalIndex] = {
                            ...nextChoices[originalIndex],
                            category: e.target.value,
                          };
                          setEditingQuestion({ ...editingQuestion, choices: nextChoices });
                        }}
                      />

                      <input
                        type="number"
                        style={numberInputStyle}
                        value={choice.value}
                        onChange={(e) => {
                          const nextChoices = [...normalizedChoices];
                          nextChoices[originalIndex] = {
                            ...nextChoices[originalIndex],
                            value: Number(e.target.value),
                          };
                          setEditingQuestion({ ...editingQuestion, choices: nextChoices });
                        }}
                      />

                      <input
                        type="number"
                        style={numberInputStyle}
                        value={choice.order}
                        onChange={(e) => {
                          const nextChoices = [...normalizedChoices];
                          nextChoices[originalIndex] = {
                            ...nextChoices[originalIndex],
                            order: Number(e.target.value),
                          };
                          setEditingQuestion({ ...editingQuestion, choices: nextChoices });
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setEditingQuestion({
                            ...editingQuestion,
                            choices: normalizedChoices.filter((_, index) => index !== originalIndex),
                          })
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        ❌
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {!editingQuestion.use_default_options && (
                <button
                  type="button"
                  style={{
                    marginTop: "8px",
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    const nextIndex = normalizedChoices.length;
                    nextOptionFocusIndexRef.current = nextIndex;

                    setEditingQuestion({
                      ...editingQuestion,
                      choices: [
                        ...normalizedChoices,
                        normalizeChoiceForEditing(
                          {
                            option: "",
                            option_more_info: "",
                            category: "",
                            report_verbiage: "",
                            value: 0,
                            order: normalizedChoices.length + 1,
                          },
                          normalizedChoices.length + 1
                        ),
                      ],
                    });
                  }}
                >
                  + Add Response
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showActive && (
        <div>
          <label style={{ ...labelStyle, display: "flex", gap: "8px" }}>
            <input
              type="checkbox"
              checked={Boolean(editingQuestion.is_active)}
              onChange={(e) =>
                setEditingQuestion({
                  ...editingQuestion,
                  is_active: e.target.checked,
                })
              }
            />
            Active
          </label>
        </div>
      )}
    </div>
  );
}