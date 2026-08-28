import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLanguage } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import "./QuestionTypes.css";

const QUESTION_TYPES_API = `${process.env.REACT_APP_API_URL_BASE}/api/question-types/`;
const LANGUAGES_API = `${process.env.REACT_APP_API_URL_BASE}/api/languages/`;
const QUESTION_TYPE_TRANSLATIONS_API = `${process.env.REACT_APP_API_URL_BASE}/api/question-type-translations`;

const emptyQuestionTypeTranslation = {
  question_type_translation_id: null,
  language_code: "en",
  question_type_id: null,
  description: "",
  options_json: "[]",
};

const formatOptionsForEditor = (options) => {
  if (typeof options === "string") {
    try {
      return JSON.stringify(JSON.parse(options), null, 2);
    } catch {
      return options;
    }
  }

  return JSON.stringify(options ?? [], null, 2);
};

const summarizeOptions = (options) => {
  if (Array.isArray(options)) {
    return `${options.length} option${options.length === 1 ? "" : "s"}`;
  }

  if (options && typeof options === "object") {
    return `${Object.keys(options).length} option${Object.keys(options).length === 1 ? "" : "s"}`;
  }

  return "No options";
};

const humanizeDescription = (description) => {
  return String(description ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const normalizeOptions = (options) => {
  if (Array.isArray(options)) {
    return options.map((option, index) => ({
      option:
        option?.option ??
        option?.label ??
        option?.description ??
        option?.name ??
        String(option ?? ""),
      order: option?.order ?? option?.ordinal ?? index + 1,
      value: option?.value ?? option?.id ?? option?.key ?? "",
    }));
  }

  if (options && typeof options === "object") {
    return Object.entries(options).map(([key, value], index) => ({
      option: key,
      order: value?.order ?? value?.ordinal ?? index + 1,
      value:
        value && typeof value === "object"
          ? value?.value ?? JSON.stringify(value)
          : value ?? "",
    }));
  }

  return [];
};

const parseApiErrorMessage = (errorBody, fallbackMessage) => {
  if (!errorBody) {
    return fallbackMessage;
  }

  try {
    const parsedError = JSON.parse(errorBody);

    if (typeof parsedError === "string") {
      return parsedError;
    }

    if (Array.isArray(parsedError)) {
      return parsedError.join(", ");
    }

    if (parsedError && typeof parsedError === "object") {
      return Object.entries(parsedError)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value.join(", ")}`;
          }

          return `${key}: ${String(value)}`;
        })
        .join(" | ");
    }
  } catch {
    return errorBody;
  }

  return fallbackMessage;
};

const extractQuestionTypeTranslationId = (translation) => {
  return (
    Number(translation?.question_type_translation_id ?? 0) ||
    Number(translation?.translation_id ?? 0) ||
    Number(translation?.id ?? 0) ||
    null
  );
};

function QuestionTypes() {
  const navigate = useNavigate();
  const [questionTypes, setQuestionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingQuestionType, setEditingQuestionType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [languages, setLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [activeTranslationTarget, setActiveTranslationTarget] = useState(null);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState("en");
  const [translationFormData, setTranslationFormData] = useState(emptyQuestionTypeTranslation);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [savingTranslation, setSavingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [translationSuccessMessage, setTranslationSuccessMessage] = useState("");
  const [isTranslationCreateMode, setIsTranslationCreateMode] = useState(false);

  const loadQuestionTypes = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiRequest(QUESTION_TYPES_API);
      if (!response.ok) {
        throw new Error(`Load question types failed with status ${response.status}`);
      }

      const data = await response.json();
      setQuestionTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load question types", error);
      setQuestionTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestionTypes();
  }, [loadQuestionTypes]);

  useEffect(() => {
    if (!isTranslationModalOpen || languages.length > 0) {
      return;
    }

    let isCancelled = false;

    const loadLanguages = async () => {
      setLanguagesLoading(true);

      try {
        const response = await apiRequest(LANGUAGES_API);
        if (!response.ok) {
          throw new Error(`Load languages failed with status ${response.status}`);
        }

        const rows = await response.json();
        if (!isCancelled) {
          setLanguages(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        console.error("Failed to load languages", error);
        if (!isCancelled) {
          setLanguages([]);
          setTranslationError("Unable to load languages right now.");
        }
      } finally {
        if (!isCancelled) {
          setLanguagesLoading(false);
        }
      }
    };

    loadLanguages();

    return () => {
      isCancelled = true;
    };
  }, [isTranslationModalOpen, languages.length]);

  useEffect(() => {
    if (!isTranslationModalOpen || !activeTranslationTarget?.question_type_id) {
      return;
    }

    if (selectedLanguageCode === "en") {
      setTranslationFormData({
        ...emptyQuestionTypeTranslation,
        language_code: "en",
        question_type_id: Number(activeTranslationTarget.question_type_id),
        description: String(activeTranslationTarget.description ?? ""),
        options_json: formatOptionsForEditor(activeTranslationTarget.options),
      });
      setIsTranslationCreateMode(false);
      setTranslationError("");
      setTranslationSuccessMessage("");
      setLoadingTranslation(false);
      return;
    }

    let isCancelled = false;

    const loadTranslation = async () => {
      setLoadingTranslation(true);
      setTranslationError("");
      setTranslationSuccessMessage("");

      try {
        const response = await apiRequest(
          `${QUESTION_TYPE_TRANSLATIONS_API}?language_code=${encodeURIComponent(selectedLanguageCode)}&question_type_id=${encodeURIComponent(activeTranslationTarget.question_type_id)}`
        );

        if (!response.ok) {
          throw new Error(`Load question type translation failed with status ${response.status}`);
        }

        const payload = await response.json();
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.results)
            ? payload.results
            : [];
        const translation = rows[0] || null;

        if (isCancelled) {
          return;
        }

        if (translation) {
          setTranslationFormData({
            question_type_translation_id: extractQuestionTypeTranslationId(translation),
            language_code: String(translation?.language_code ?? selectedLanguageCode),
            question_type_id: Number(translation?.question_type_id ?? activeTranslationTarget.question_type_id),
            description: String(translation?.description ?? ""),
            options_json: formatOptionsForEditor(translation?.options),
          });
          setIsTranslationCreateMode(false);
        } else {
          setTranslationFormData({
            ...emptyQuestionTypeTranslation,
            language_code: selectedLanguageCode,
            question_type_id: Number(activeTranslationTarget.question_type_id),
            description: String(activeTranslationTarget.description ?? ""),
            options_json: formatOptionsForEditor(activeTranslationTarget.options),
          });
          setIsTranslationCreateMode(true);
          setTranslationError("");
        }
      } catch (error) {
        console.error("Failed to load question type translation", error);
        if (!isCancelled) {
          setTranslationFormData({
            ...emptyQuestionTypeTranslation,
            language_code: selectedLanguageCode,
            question_type_id: Number(activeTranslationTarget.question_type_id),
          });
          setIsTranslationCreateMode(false);
          setTranslationError("Unable to load the question type translation right now.");
        }
      } finally {
        if (!isCancelled) {
          setLoadingTranslation(false);
        }
      }
    };

    loadTranslation();

    return () => {
      isCancelled = true;
    };
  }, [activeTranslationTarget, isTranslationModalOpen, selectedLanguageCode]);

  const filteredQuestionTypes = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return [...questionTypes].sort((left, right) =>
        Number(left?.question_type_id ?? 0) - Number(right?.question_type_id ?? 0)
      );
    }

    return questionTypes
      .filter((questionType) => {
        return (
          String(questionType?.question_type_id ?? "").toLowerCase().includes(searchText) ||
          String(questionType?.description ?? "").toLowerCase().includes(searchText)
        );
      })
      .sort((left, right) =>
        Number(left?.question_type_id ?? 0) - Number(right?.question_type_id ?? 0)
      );
  }, [questionTypes, search]);

  const openEditModal = (questionType) => {
    setErrorMessage("");
    setEditingQuestionType({
      question_type_id: questionType?.question_type_id,
      description: String(questionType?.description ?? ""),
      options_json: formatOptionsForEditor(questionType?.options),
    });
  };

  const closeEditModal = () => {
    setEditingQuestionType(null);
    setSaving(false);
    setErrorMessage("");
  };

  const openTranslationModal = (questionType) => {
    setActiveTranslationTarget({
      question_type_id: Number(questionType?.question_type_id ?? 0) || null,
      description: String(questionType?.description ?? ""),
      options: questionType?.options ?? [],
    });
    setSelectedLanguageCode("en");
    setTranslationFormData({
      ...emptyQuestionTypeTranslation,
      language_code: "en",
      question_type_id: Number(questionType?.question_type_id ?? 0) || null,
      description: String(questionType?.description ?? ""),
      options_json: formatOptionsForEditor(questionType?.options),
    });
    setTranslationError("");
    setTranslationSuccessMessage("");
    setIsTranslationCreateMode(false);
    setIsTranslationModalOpen(true);
  };

  const closeTranslationModal = () => {
    setIsTranslationModalOpen(false);
    setActiveTranslationTarget(null);
    setSelectedLanguageCode("en");
    setTranslationFormData(emptyQuestionTypeTranslation);
    setLoadingTranslation(false);
    setSavingTranslation(false);
    setTranslationError("");
    setTranslationSuccessMessage("");
    setIsTranslationCreateMode(false);
  };

  const handleSave = async () => {
    if (!editingQuestionType) return;

    setSaving(true);
    setErrorMessage("");

    try {
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(editingQuestionType.options_json || "[]");
      } catch {
        setErrorMessage("Options must be valid JSON.");
        return;
      }

      const payload = {
        description: editingQuestionType.description,
        options: parsedOptions,
      };

      let response = await apiRequest(
        `${QUESTION_TYPES_API}${editingQuestionType.question_type_id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok && response.status === 405) {
        response = await apiRequest(
          `${QUESTION_TYPES_API}${editingQuestionType.question_type_id}/`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question_type_id: editingQuestionType.question_type_id,
              ...payload,
            }),
          }
        );
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          errorBody || `Update question type failed with status ${response.status}`
        );
      }

      const updated = await response.json();
      setQuestionTypes((prev) =>
        prev.map((questionType) =>
          Number(questionType?.question_type_id) === Number(updated?.question_type_id)
            ? updated
            : questionType
        )
      );
      closeEditModal();
    } catch (error) {
      console.error("Failed to save question type", error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Unable to save question type right now."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTranslationFieldChange = (field, value) => {
    setTranslationSuccessMessage("");
    setTranslationFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveTranslation = async () => {
    const translationId = extractQuestionTypeTranslationId(translationFormData);

    setSavingTranslation(true);
    setTranslationError("");
    setTranslationSuccessMessage("");

    try {
      let parsedOptions = [];
      const rawOptionsJson = String(translationFormData.options_json ?? "[]").trim();

      if (rawOptionsJson) {
        try {
          parsedOptions = JSON.parse(rawOptionsJson);
        } catch {
          setTranslationError("Options must be valid JSON.");
          return;
        }
      }

      const payload = {
        description: String(translationFormData.description ?? ""),
        options: parsedOptions,
      };

      if (!isTranslationCreateMode && !translationId) {
        setTranslationError("A translation record is required before changes can be saved.");
        return;
      }

      const requestPath = isTranslationCreateMode
        ? `${QUESTION_TYPE_TRANSLATIONS_API}/`
        : `${QUESTION_TYPE_TRANSLATIONS_API}/${translationId}/`;
      const requestMethod = isTranslationCreateMode ? "POST" : "PATCH";

      let response = await apiRequest(requestPath, {
        method: requestMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isTranslationCreateMode
            ? {
                ...payload,
                question_type_id: translationFormData.question_type_id,
                language_code: translationFormData.language_code,
              }
            : payload
        ),
      });

      if (!response.ok && !isTranslationCreateMode && response.status === 405) {
        response = await apiRequest(`${QUESTION_TYPE_TRANSLATIONS_API}/${translationId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_type_translation_id: translationId,
            question_type_id: translationFormData.question_type_id,
            language_code: translationFormData.language_code,
            ...payload,
          }),
        });
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          parseApiErrorMessage(
            errorBody,
            `${isTranslationCreateMode ? "Create" : "Update"} question type translation failed with status ${response.status}`
          )
        );
      }

      const updated = await response.json();
      setTranslationFormData({
        question_type_translation_id: extractQuestionTypeTranslationId(updated),
        language_code: String(updated?.language_code ?? translationFormData.language_code),
        question_type_id: Number(updated?.question_type_id ?? translationFormData.question_type_id),
        description: String(updated?.description ?? translationFormData.description ?? ""),
        options_json: formatOptionsForEditor(updated?.options ?? parsedOptions),
      });
      setIsTranslationCreateMode(false);
      setTranslationSuccessMessage(
        isTranslationCreateMode
          ? "Question type translation created successfully."
          : "Question type translation saved successfully."
      );
    } catch (error) {
      console.error("Failed to save question type translation", error);
      setTranslationError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to save question type translation changes right now."
      );
    } finally {
      setSavingTranslation(false);
    }
  };

  return (
    <div className="question-types-page">
      <div className="question-types-wrapper">
        <div className="question-types-header-row">
          <button
            type="button"
            className="question-types-back-btn"
            onClick={() => navigate("/assessments")}
          >
            {"< Back to Assessments"}
          </button>
          <h2 className="question-types-title">Question Types</h2>
        </div>

        <div className="question-types-toolbar">
          <input
            className="question-types-search"
            placeholder="Search question types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="question-types-empty">Loading question types...</div>
        ) : filteredQuestionTypes.length === 0 ? (
          <div className="question-types-empty">No question types found.</div>
        ) : (
          <div className="question-types-list">
            {filteredQuestionTypes.map((questionType) => (
              <div key={questionType.question_type_id} className="question-type-card">
                <div className="question-type-card-header">
                  <div>
                    <div className="question-type-card-title">
                      {humanizeDescription(questionType.description)}
                    </div>
                    <div className="question-type-card-subtitle">
                      {summarizeOptions(questionType.options)}
                    </div>
                  </div>
                  <div className="question-type-card-actions">
                    <button
                      type="button"
                      className="question-type-language-btn"
                      title={`Language translations for ${humanizeDescription(questionType.description)}`}
                      aria-label={`Language translations for ${humanizeDescription(questionType.description)}`}
                      onClick={() => openTranslationModal(questionType)}
                    >
                      <FontAwesomeIcon icon={faLanguage} />
                    </button>
                    <button
                      type="button"
                      className="question-type-edit-btn"
                      onClick={() => openEditModal(questionType)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="question-type-details-list">
                  <div className="question-type-detail-item">
                    <span className="question-type-detail-label">Type ID:</span>
                    <span className="question-type-detail-value">{questionType.question_type_id}</span>
                  </div>
                  <div className="question-type-detail-item">
                    <span className="question-type-detail-label">Description:</span>
                    <span className="question-type-detail-value">
                      {String(questionType.description ?? "")}
                    </span>
                  </div>
                </div>

                <div className="question-type-options-section">
                  <div className="question-type-options-heading">Options</div>
                  {normalizeOptions(questionType.options).length === 0 ? (
                    <div className="question-type-no-options">No options</div>
                  ) : (
                    <div className="question-type-options-table-wrap">
                      <table className="question-type-options-table">
                        <thead>
                          <tr>
                            <th>Option</th>
                            <th>Order</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {normalizeOptions(questionType.options).map((optionRow, index) => (
                            <tr key={`${questionType.question_type_id}-${optionRow.option}-${index}`}>
                              <td>{String(optionRow.option ?? "")}</td>
                              <td>{String(optionRow.order ?? "")}</td>
                              <td>{String(optionRow.value ?? "")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {editingQuestionType && (
          <div className="question-type-modal-overlay">
            <div className="question-type-modal">
              <div className="question-type-modal-header">
                <div>
                  <div className="question-type-modal-title">
                    Edit Question Type #{editingQuestionType.question_type_id}
                  </div>
                  <div className="question-type-modal-subtitle">
                    Update the description and options JSON.
                  </div>
                </div>
                <button
                  type="button"
                  className="question-type-close-btn"
                  onClick={closeEditModal}
                >
                  Close
                </button>
              </div>

              <div className="question-type-modal-body">
                <label className="question-type-field">
                  <span>Question Type ID</span>
                  <input
                    type="text"
                    value={editingQuestionType.question_type_id}
                    disabled
                  />
                </label>

                <label className="question-type-field">
                  <span>Description</span>
                  <input
                    type="text"
                    value={editingQuestionType.description}
                    onChange={(e) =>
                      setEditingQuestionType((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>

                <label className="question-type-field">
                  <span>Options JSON</span>
                  <textarea
                    rows={18}
                    value={editingQuestionType.options_json}
                    onChange={(e) =>
                      setEditingQuestionType((prev) => ({
                        ...prev,
                        options_json: e.target.value,
                      }))
                    }
                  />
                </label>

                {errorMessage && (
                  <div className="question-type-error">{errorMessage}</div>
                )}
              </div>

              <div className="question-type-modal-footer">
                <button type="button" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isTranslationModalOpen && (
          <div className="question-type-modal-overlay">
            <div className="question-type-modal question-type-translation-modal">
              <div className="question-type-modal-header">
                <div>
                  <div className="question-type-modal-title">
                    Question Type Language Translations
                    {activeTranslationTarget?.description
                      ? `: ${humanizeDescription(activeTranslationTarget.description)}`
                      : ""}
                  </div>
                  <div className="question-type-modal-subtitle">
                    Manage translated question type details.
                  </div>
                </div>
                <button
                  type="button"
                  className="question-type-close-btn"
                  onClick={closeTranslationModal}
                >
                  Close
                </button>
              </div>

              <div className="question-type-modal-body question-type-translation-body">
                <div className="question-type-translation-panel">
                  <div className="question-type-translation-panel-title">Language</div>
                  <label className="question-type-field">
                    <span>Select language</span>
                    <select
                      value={selectedLanguageCode}
                      onChange={(e) => setSelectedLanguageCode(e.target.value)}
                      disabled={languagesLoading}
                      className="question-type-select"
                    >
                      <option value="en">English</option>
                      {languages
                        .filter((language) => language?.code && language.code !== "en")
                        .map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {languagesLoading && (
                    <div className="question-type-helper-text">Loading languages...</div>
                  )}
                  {selectedLanguageCode === "en" && (
                    <div className="question-type-helper-text">
                      Select a non-English language to edit translated question type details.
                    </div>
                  )}
                </div>

                {selectedLanguageCode !== "en" && (
                  <div className="question-type-translation-panel">
                    <div className="question-type-translation-toolbar">
                      <div>
                        <div className="question-type-translation-panel-title">Translation Details</div>
                        <div className="question-type-helper-text">
                          {isTranslationCreateMode
                            ? "No translation record exists yet. English values are prefilled for editing."
                            : "Update the translated description and options JSON for this question type."}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="question-type-save-translation-btn"
                        onClick={handleSaveTranslation}
                        disabled={savingTranslation || loadingTranslation}
                      >
                        {savingTranslation ? "Saving..." : "Save Translation"}
                      </button>
                    </div>

                    {loadingTranslation ? (
                      <div className="question-type-helper-text">Loading question type translation...</div>
                    ) : (
                      <>
                        {translationError && (
                          <div className="question-type-error">{translationError}</div>
                        )}

                        {translationSuccessMessage && (
                          <div className="question-type-success">{translationSuccessMessage}</div>
                        )}

                        <div className="question-type-translation-fields">
                          <div className="question-type-detail-item">
                            <span className="question-type-detail-label">Type ID:</span>
                            <span className="question-type-detail-value">
                              {translationFormData.question_type_id}
                            </span>
                          </div>

                          <label className="question-type-field">
                            <span>Description</span>
                            <input
                              type="text"
                              value={translationFormData.description}
                              onChange={(e) =>
                                handleTranslationFieldChange("description", e.target.value)
                              }
                            />
                          </label>

                          <label className="question-type-field">
                            <span>Options JSON</span>
                            <textarea
                              rows={18}
                              value={translationFormData.options_json}
                              onChange={(e) =>
                                handleTranslationFieldChange("options_json", e.target.value)
                              }
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuestionTypes;