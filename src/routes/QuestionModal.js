// src/routes/QuestionModal.js
import React from "react";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: "#f5f6f8",
  border: "none",
  borderRadius: "6px",
  fontSize: "0.95rem",
};

const numberInputStyle = {
  ...inputStyle,
  textAlign: "center",
};

const labelStyle = {
  color: "#2563eb",
  fontWeight: 600,
};


export default function QuestionModal({
  isOpen,
  isCreateMode,
  editingQuestion,
  setEditingQuestion,
  questionTypes,
  conditionalSections,
  selectedQuestionType,
  saving,
  onCancel,
  onSave,
}) {
  const optionInputRefs = React.useRef({});
  const nextOptionFocusIndexRef = React.useRef(null);
  const choicesLength = editingQuestion?.choices?.length ?? 0;

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

  if (!isOpen || !editingQuestion) return null;
//   console.log("editingQuestion", editingQuestion )
//   console.log("is create mode", isCreateMode)

  const isPerformTaskVideo =
    String(selectedQuestionType?.description ?? "").trim().toLowerCase() ===
    "perform_task_video";

  const sortedChoices = [...editingQuestion.choices].sort(
        (a, b) => a.order - b.order
    );

  const conditionalResponseOptions = sortedChoices
    .map((choice, idx) => {
      const optionLabel = String(choice?.option ?? "").trim();
      if (!optionLabel) return null;
      return {
        key: `${optionLabel}-${idx}`,
        label: optionLabel,
      };
    })
    .filter(Boolean);

  const isConditionalResponseEnabled = Boolean(
    editingQuestion.conditional_response_enabled
  );
  const conditionalOptionToDisplay =
    editingQuestion.conditional_response_option ?? "";
  const conditionalValue =
    editingQuestion.conditional_response_value === undefined ||
    editingQuestion.conditional_response_value === null
      ? ""
      : String(editingQuestion.conditional_response_value);
  const hideConditionalResponseControls = Boolean(
    editingQuestion.hide_conditional_response_controls
  );
  const conditionalTargetSectionId =
    editingQuestion.target_section_id === undefined ||
    editingQuestion.target_section_id === null
      ? ""
      : String(editingQuestion.target_section_id);
    // console.log("sorted choices", sortedChoices)

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          width: "900px",
          maxHeight: "90vh",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #eee",
            fontWeight: 600,
            fontSize: "1.1rem",
          }}
        >
          {isCreateMode
            ? hideConditionalResponseControls
              ? "Add Question - Conditional Flow"
              : "Add Question"
            : "Edit Question"}
        </div>

        {/* Body */}
        <div style={{ padding: "24px", overflowY: "auto" }}>
          {/* Title */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Title</label>
            <input
              style={inputStyle}
              value={editingQuestion.title}
              onChange={(e) =>
                setEditingQuestion({ ...editingQuestion, title: e.target.value })
              }
            />
          </div>

          {/* Question */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Question Verbiage</label>
            <textarea
              rows={3}
              style={inputStyle}
              value={editingQuestion.question}
              onChange={(e) =>
                setEditingQuestion({
                  ...editingQuestion,
                  question: e.target.value,
                })
              }
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Question Order</label>
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              style={{ ...numberInputStyle, width: "96px" }}
              value={
                editingQuestion.question_order === undefined ||
                editingQuestion.question_order === null
                  ? ""
                  : editingQuestion.question_order
              }
              onChange={(e) => {
                const rawValue = e.target.value;
                const parsed = Number(rawValue);

                setEditingQuestion({
                  ...editingQuestion,
                  question_order:
                    rawValue === "" || !Number.isFinite(parsed) || parsed <= 0
                      ? undefined
                      : Math.min(999, Math.floor(parsed)),
                });
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ ...labelStyle, display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={Boolean(editingQuestion.is_required)}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    is_required: e.target.checked,
                  })
                }
              />
              Required
            </label>
          </div>

          {/* Question Type */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Question Response Types</label>
            <select
              style={inputStyle}
              value={editingQuestion.question_type_id}
              onChange={(e) => {
                const newTypeId = Number(e.target.value);
                const qt = questionTypes.find(
                    (t) => t.question_type_id === newTypeId
                );

                const options = qt?.options;
                const nextChoices = Array.isArray(options)
                  ? options.map((opt, idx) => ({
                      option: opt?.option ?? "",
                      value: Number(opt?.value ?? 0),
                      order: Number(opt?.order ?? idx + 1),
                    }))
                  : options && typeof options === "object"
                    ? Object.entries(options).map(([option, value], idx) => ({
                        option,
                        value: Number(value ?? 0),
                        order: idx + 1,
                      }))
                    : [];

                setEditingQuestion({
                    ...editingQuestion,
                    question_type_id: newTypeId,
                    choices: nextChoices,
                });
            }}

            >
              {questionTypes.map((qt) => (
                <option key={qt.question_type_id} value={qt.question_type_id}>
                  {qt.description.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {isPerformTaskVideo && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Hyperlink</label>
              <input
                style={inputStyle}
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

          {/* Default Options Toggle */}
          {/* {selectedQuestionType?.options && (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "flex", gap: "8px" }}>
                <input
                  type="checkbox"
                  checked={editingQuestion.use_default_options}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditingQuestion({
                      ...editingQuestion,
                      use_default_options: checked,
                      choices: checked
                        ? Object.entries(selectedQuestionType.options).map(
                            ([option, value], idx) => ({
                              option,
                              value,
                              order: idx + 1,
                            })
                          )
                        : [],
                    });
                  }}
                />
                Use default response options
              </label>
            </div>
          )} */}

          {/* Choices */}
          <div>
            <div
              style={{
                fontWeight: 600,
                marginBottom: "8px",
                color: "#2563eb",
              }}
            >
              Response Options
            </div>

            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 40px",
                fontSize: "0.8rem",
                color: "#666",
                padding: "6px 0",
              }}
            >
              <div>Option</div>
              <div style={{ textAlign: "center" }}>Value</div>
              <div style={{ textAlign: "center" }}>Order</div>
              <div />
            </div>

            {/* Rows */}
            {sortedChoices.map((r, idx) => {
                const originalIndex = editingQuestion.choices.indexOf(r);

                return (
                    <div
                    key={`choice-${originalIndex}-${idx}`}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 90px 90px 40px",
                        gap: "8px",
                        marginBottom: "8px",
                    }}
                    >

                    <input
                      ref={(el) => {
                      if (el) {
                        optionInputRefs.current[originalIndex] = el;
                      } else {
                        delete optionInputRefs.current[originalIndex];
                      }
                      }}
                        style={inputStyle}
                        value={r.option}
                        onChange={(e) => {
                        const next = [...editingQuestion.choices];
                        next[originalIndex] = {
                            ...next[originalIndex],
                            option: e.target.value,
                        };
                        setEditingQuestion({ ...editingQuestion, choices: next });
                        }}
                    />


                    <input
                        type="number"
                        style={numberInputStyle}
                        value={r.value}
                        onChange={(e) => {
                        const next = [...editingQuestion.choices];
                        next[originalIndex] = {
                            ...next[originalIndex],
                            value: Number(e.target.value),
                        };
                        setEditingQuestion({ ...editingQuestion, choices: next });
                        }}
                    />

                    <input
                        type="number"
                        style={numberInputStyle}
                        value={r.order}
                        onChange={(e) => {
                        const next = [...editingQuestion.choices];
                        next[originalIndex] = {
                            ...next[originalIndex],
                            order: Number(e.target.value),
                        };
                        setEditingQuestion({ ...editingQuestion, choices: next });
                        }}
                    />

                    <button
                        onClick={() =>
                        setEditingQuestion({
                            ...editingQuestion,
                            choices: editingQuestion.choices.filter(
                            (_, i) => i !== originalIndex
                            ),
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
                    </div>
                );
                })}



            {!editingQuestion.use_default_options && (
              <button
                style={{
                    marginTop: "8px",
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                }}
                onClick={() =>
                  {
                  const nextIndex = editingQuestion.choices.length;
                  nextOptionFocusIndexRef.current = nextIndex;

                    setEditingQuestion({
                    ...editingQuestion,
                    choices: [
                        ...editingQuestion.choices,
                        {
                        option: "",
                        value: 0,
                        order: editingQuestion.choices.length + 1,
                        },
                    ],
                    })
                      }
                }
                >
                + Add Response
            </button>

            )}
          </div>

          {/* Active */}
          <div style={{ marginTop: "24px" }}>
            <label style={{ ...labelStyle, display: "flex", gap: "8px" }}>
              <input
                type="checkbox"
                checked={editingQuestion.is_active}
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

          {!hideConditionalResponseControls && (
            <div style={{ marginTop: "16px" }}>
              <label style={{ ...labelStyle, display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isConditionalResponseEnabled}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      conditional_response_enabled: e.target.checked,
                    })
                  }
                />
                Conditional Response
              </label>
            </div>
          )}

          {!hideConditionalResponseControls && isConditionalResponseEnabled && (
            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "1fr 220px 220px",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div>
                <label style={labelStyle}>Target Section</label>
                <select
                  style={inputStyle}
                  value={conditionalTargetSectionId}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      target_section_id: e.target.value ? Number(e.target.value) : "",
                    })
                  }
                >
                  <option value="">Select target section</option>
                  {(conditionalSections || []).map((section) => (
                    <option key={section.section_id} value={section.section_id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Response Option</label>
                <select
                  style={inputStyle}
                  value={conditionalOptionToDisplay}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      conditional_response_option: e.target.value,
                    })
                  }
                >
                  <option value="">Select response option</option>
                  {conditionalResponseOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Trigger Value</label>
                <input
                  style={inputStyle}
                  value={conditionalValue}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      conditional_response_value: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #eee",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button onClick={onCancel}>Cancel</button>
          <button
            disabled={saving}
            onClick={() =>
              onSave({
                isConditionalResponseEnabled,
                conditionalTargetSectionId,
                conditionalOptionToDisplay,
                conditionalValue,
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
