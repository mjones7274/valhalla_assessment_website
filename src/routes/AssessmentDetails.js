// src/routes/Priorities.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QuestionModal from "./QuestionModal";
import RunAssessment from "./RunAssessment";
import { apiRequest } from "../api";
import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";

// Font Awesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEdit, faTrash, faChevronDown, faChevronRight  } from "@fortawesome/free-solid-svg-icons";

function AssessmentDetails() {
  const useClientTerminology = shouldUseClientTerminology();

  const [assessmentDetails, setAssessmentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [isAddExistingOpen, setIsAddExistingOpen] = useState(false);
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [selectedExistingQuestionId, setSelectedExistingQuestionId] = useState(null);
  const [isNewSectionOpen, setIsNewSectionOpen] = useState(false);
  const [newSectionData, setNewSectionData] = useState({
    title: "",
    description: "",
    instructions: "",
    is_conditional: false,
  });
  const [isAddExistingSectionOpen, setIsAddExistingSectionOpen] = useState(false);
  const [existingSections] = useState([]);
  const [selectedExistingSectionId, setSelectedExistingSectionId] = useState(null);
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false);
  const [deletingSection, setDeletingSection] = useState(null); // { section_id, section_order }
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [isEditAssessmentOpen, setIsEditAssessmentOpen] = useState(false);
  const [isRunAssessmentOpen, setIsRunAssessmentOpen] = useState(false);
  const [runStartQuestionSectionId, setRunStartQuestionSectionId] = useState(null);
  const [runStartQuestionId, setRunStartQuestionId] = useState(null);
  const [runForceConditionalSourceQuestionId, setRunForceConditionalSourceQuestionId] = useState(null);
  const [runForceConditionalTargetSectionId, setRunForceConditionalTargetSectionId] = useState(null);
  const [editAssessmentData, setEditAssessmentData] = useState({
    name: "",
    description: "",
    patient_instructions: "",
    patient_title: "",
    is_active: true,
  });
  const [savingAssessmentDetails, setSavingAssessmentDetails] = useState(false);

  const [draggedQuestionSectionId, setDraggedQuestionSectionId] = useState(null);
  const [draggedFromSectionId, setDraggedFromSectionId] = useState(null);
  const [isReorderingQuestions, setIsReorderingQuestions] = useState(false);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [questionFlowRules, setQuestionFlowRules] = useState([]);
  const [conditionalSections, setConditionalSections] = useState([]);
  const [conditionalSectionQuestions, setConditionalSectionQuestions] = useState({});
  const [conditionalCreateCardHeights, setConditionalCreateCardHeights] = useState({});
  const normalFlowCardRefs = useRef({});




  // deletingTarget = { section_id, question_id, question_section_id }

  const selectedQuestionType = questionTypes.find(
    (qt) => qt.question_type_id === editingQuestion?.question_type_id
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const searchParams = new URLSearchParams(location.search);
  const runPatientId = Number(searchParams.get("patient_id"));
  const runPatientEventId = Number(searchParams.get("patient_event_id"));

  const viewIconStyle = {
    cursor: "pointer",
    marginLeft: "12px",
    color: "#17a2b8",
  };

  const editIconStyle = {
    cursor: "pointer",
    marginLeft: "12px",
    color: "#007bff", // strong blue
  };

  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      setLoading(true);

      const url =
        process.env.REACT_APP_API_URL_BASE +
        `/api/assessments-detail/${id}/`;

      try {
        const res = await apiRequest(url);
        const data = await res.json();
        setAssessmentDetails(data);
      } catch (err) {
        console.error("Error fetching assessment details:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchQuestionFlowRules = async () => {
      const rulesUrl =
        process.env.REACT_APP_API_URL_BASE +
        `/api/question-flow-rules/?assessment=${id}`;

      try {
        const res = await apiRequest(rulesUrl);
        if (!res.ok) {
          setQuestionFlowRules([]);
          return;
        }

        const data = await res.json();
        setQuestionFlowRules(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching question flow rules:", err);
        setQuestionFlowRules([]);
      }
    };

    const fetchConditionalSections = async () => {
      const sectionsUrl =
        process.env.REACT_APP_API_URL_BASE +
        `/api/sections/?is_conditional=1`;

      try {
        const res = await apiRequest(sectionsUrl);
        if (!res.ok) {
          setConditionalSections([]);
          return;
        }

        const data = await res.json();
        setConditionalSections(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching conditional sections:", err);
        setConditionalSections([]);
      }
    };

    fetchAssessmentDetails();
    fetchQuestionFlowRules();
    fetchConditionalSections();

    apiRequest(`${process.env.REACT_APP_API_URL_BASE}/api/question-types/`)
      .then((res) => res.json())
      .then(setQuestionTypes)
      .catch(console.error);
  }, [navigate, id]);

  useEffect(() => {
    const targetSectionIds = Array.from(
      new Set(
        (questionFlowRules || [])
          .filter((rule) => (rule?.is_active ?? true))
          .map((rule) =>
            Number(rule?.target_section?.section_id ?? rule?.target_section_id)
          )
          .filter((sectionId) => Number.isFinite(sectionId) && sectionId > 0)
      )
    );

    if (!targetSectionIds.length) {
      setConditionalSectionQuestions({});
      return;
    }

    const targetSectionIdSet = new Set(targetSectionIds);

    const fetchConditionalSectionQuestions = async () => {
      try {
        const res = await apiRequest(
          `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/`
        );

        if (!res.ok) {
          setConditionalSectionQuestions({});
          return;
        }

        const data = await res.json();
        const grouped = {};

        (Array.isArray(data) ? data : []).forEach((questionSection) => {
          const sectionId = Number(
            questionSection?.section_id ??
              questionSection?.section?.section_id ??
              questionSection?.section?.id
          );

          if (!Number.isFinite(sectionId) || !targetSectionIdSet.has(sectionId)) {
            return;
          }

          if (!grouped[sectionId]) grouped[sectionId] = [];
          grouped[sectionId].push(questionSection);
        });

        Object.keys(grouped).forEach((sectionId) => {
          grouped[sectionId] = grouped[sectionId].slice().sort((left, right) => {
            const leftOrder = Number(
              left?.question_order ?? left?.order ?? left?.question_section_order ?? 0
            );
            const rightOrder = Number(
              right?.question_order ?? right?.order ?? right?.question_section_order ?? 0
            );

            return leftOrder - rightOrder;
          });
        });

        setConditionalSectionQuestions(grouped);
      } catch (err) {
        console.error("Error fetching conditional section questions:", err);
        setConditionalSectionQuestions({});
      }
    };

    fetchConditionalSectionQuestions();
  }, [questionFlowRules]);

  useEffect(() => {
    const nextHeights = {};

    Object.entries(normalFlowCardRefs.current).forEach(([key, element]) => {
      if (!element) return;
      const measuredHeight = element.getBoundingClientRect?.().height;
      if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
        nextHeights[key] = measuredHeight;
      }
    });

    setConditionalCreateCardHeights((prev) => {
      const prevKeys = Object.keys(prev || {});
      const nextKeys = Object.keys(nextHeights);
      if (prevKeys.length === nextKeys.length) {
        const hasChange = nextKeys.some((key) => prev[key] !== nextHeights[key]);
        if (!hasChange) return prev;
      }

      return nextHeights;
    });
  }, [assessmentDetails, conditionalSectionQuestions, questionFlowRules, expandedSections]);

  const flowRuleSourceQuestionKeys = useMemo(() => {
    const keys = new Set();

    (questionFlowRules || []).forEach((rule) => {
      const isActive = rule?.is_active ?? true;
      const sectionId = Number(
        rule?.source_section?.section_id ?? rule?.source_section_id
      );
      const questionId = Number(
        rule?.source_question?.question_id ?? rule?.source_question_id
      );

      if (!isActive) return;
      if (!Number.isFinite(sectionId) || !Number.isFinite(questionId)) return;

      keys.add(`${sectionId}:${questionId}`);
    });

    return keys;
  }, [questionFlowRules]);

  const isFlowRuleSourceQuestion = (sectionId, questionId) => {
    const normalizedSectionId = Number(sectionId);
    const normalizedQuestionId = Number(questionId);

    if (!Number.isFinite(normalizedSectionId) || !Number.isFinite(normalizedQuestionId)) {
      return false;
    }

    return flowRuleSourceQuestionKeys.has(`${normalizedSectionId}:${normalizedQuestionId}`);
  };

  const getFlowRuleTargetSectionId = (rule) => {
    const parsed = Number(rule?.target_section?.section_id ?? rule?.target_section_id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const getConditionalFlowDisplayTitle = (title) => {
    const normalizedTitle = String(title || "").trim();
    if (normalizedTitle.length <= 35) return normalizedTitle || "Question Title";
    return `${normalizedTitle.slice(0, 35).trimEnd()}...`;
  };

  const getFlowRuleForQuestion = (sectionId, questionId) => {
    const normalizedSectionId = Number(sectionId);
    const normalizedQuestionId = Number(questionId);

    if (!Number.isFinite(normalizedSectionId) || !Number.isFinite(normalizedQuestionId)) {
      return null;
    }

    return (
      (questionFlowRules || []).find((rule) => {
        const isActive = rule?.is_active ?? true;
        const ruleSectionId = Number(
          rule?.source_section?.section_id ?? rule?.source_section_id
        );
        const ruleQuestionId = Number(
          rule?.source_question?.question_id ?? rule?.source_question_id
        );

        return (
          isActive &&
          Number.isFinite(ruleSectionId) &&
          Number.isFinite(ruleQuestionId) &&
          ruleSectionId === normalizedSectionId &&
          ruleQuestionId === normalizedQuestionId
        );
      }) || null
    );
  };

  const getFlowRuleId = (rule) => {
    const parsed = Number(rule?.flow_rule_id ?? rule?.question_flow_rule_id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const toFlowRuleMatchValueArray = (matchValue) => {
    if (Array.isArray(matchValue)) return matchValue;
    if (matchValue && typeof matchValue === "object") return [matchValue];
    return [];
  };

  const getFlowRuleConditionDisplay = (rule) => {
    const matchValues = toFlowRuleMatchValueArray(rule?.match_value);
    const firstMatch = matchValues[0] || null;
    if (!firstMatch) return null;

    const option = String(firstMatch?.option ?? "").trim();
    const rawValue = firstMatch?.value;
    const value =
      rawValue === undefined || rawValue === null
        ? ""
        : typeof rawValue === "string"
          ? rawValue
          : JSON.stringify(rawValue);

    if (!option && !value) return null;
    if (!option) return value;
    if (!value) return option;
    return `${option} = ${value}`;
  };

  if (loading || !assessmentDetails) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <span>Loading assessment details...</span>
      </div>
    );

  }

  const openEditModal = async (
    questionId,
    questionSectionId,
    sectionId,
    questionOrder,
    isRequired
  ) => {
    try {
      // Load question
      const questionRes = await apiRequest(
        `${process.env.REACT_APP_API_URL_BASE}/api/questions/${questionId}/`
      );
      const questionData = await questionRes.json();

      // Load question types
      const typesRes = await apiRequest(
        `${process.env.REACT_APP_API_URL_BASE}/api/question-types/`
      );
      const typesData = await typesRes.json();

      const parsedQuestionOrder = Number(questionOrder);
      const normalizedQuestionOrder =
        Number.isFinite(parsedQuestionOrder) && parsedQuestionOrder > 0
          ? parsedQuestionOrder
          : undefined;

      const normalizedIsRequired = Boolean(isRequired);
      const isMainAssessmentSection = assessmentDetails?.sections?.some(
        (sec) => Number(sec?.section?.section_id) === Number(sectionId)
      );
      const matchingFlowRule = getFlowRuleForQuestion(sectionId, questionId);
      const matchValueArray = toFlowRuleMatchValueArray(matchingFlowRule?.match_value);
      const firstMatchValue = matchValueArray[0] || null;
      const hydratedConditionalOption = String(firstMatchValue?.option ?? "").trim();
      const hydratedConditionalValue =
        firstMatchValue?.value === undefined || firstMatchValue?.value === null
          ? ""
          : String(firstMatchValue.value);
      const hydratedTargetSectionId = Number(
        matchingFlowRule?.target_section?.section_id ??
        matchingFlowRule?.target_section_id
      );

      setEditingQuestion({
        question_id: questionData.question_id,
        question_section_id: questionSectionId,
        section_id: sectionId,
        question_order: normalizedQuestionOrder,
        is_required: normalizedIsRequired,
        title: questionData.title,
        question: questionData.question,
        hyperlink: questionData.hyperlink || "",
        is_active: questionData.is_active,
        question_type_id: questionData.question_type.question_type_id,
        use_default_options: questionData.use_default_options,

        choices: questionData.use_default_options
          ? (questionData.question_type.options || []).map((opt) => ({
              option: opt.option,
              value: opt.value,
              order: opt.order,
            }))
          : (questionData.choices || []).map((c) => ({
              option: c.option,
              value: c.value,
              order: c.order,
            })),
        conditional_response_enabled: Boolean(matchingFlowRule),
        conditional_response_option: hydratedConditionalOption,
        conditional_response_value: hydratedConditionalValue,
        question_flow_rule_id: getFlowRuleId(matchingFlowRule),
        question_flow_rule_match_value: matchValueArray,
        target_section_id:
          Number.isFinite(hydratedTargetSectionId) && hydratedTargetSectionId > 0
            ? hydratedTargetSectionId
            : "",
        original_target_section_id:
          Number.isFinite(hydratedTargetSectionId) && hydratedTargetSectionId > 0
            ? hydratedTargetSectionId
            : "",
        hide_conditional_response_controls: !isMainAssessmentSection,

      });


      setQuestionTypes(typesData);
      setIsEditOpen(true);
    } catch (err) {
      console.error("Failed to load question", err);
    }
  };

  const updateQuestionSectionOrdersInSectionInState = (sectionId, orderedQuestionSections) => {
    setAssessmentDetails((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        sections: prev.sections.map((sec) => {
          const secId = sec?.section?.section_id;
          if (secId !== sectionId) return sec;

          const nextQuestions = (orderedQuestionSections ?? []).map((qs, index) => ({
            ...qs,
            question_order: index + 1,
          }));

          return {
            ...sec,
            section: {
              ...sec.section,
              questions: nextQuestions,
            },
          };
        }),
      };
    });
  };

  const persistQuestionSectionOrders = async (updates) => {
    if (!updates?.length) return;

    await Promise.all(
      updates.map(({ question_section_id, question_order }) =>
        apiRequest(
          `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/${question_section_id}/`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question_order }),
          }
        )
      )
    );
  };

  const moveQuestionWithinSection = async (section, targetQuestionSectionId, position = "before") => {
    const sectionId = section?.section_id;
    if (!sectionId) return;
    if (isReorderingQuestions) return;

    if (!draggedQuestionSectionId || draggedFromSectionId !== sectionId) {
      return;
    }

    const questionsInOrder = [...(section?.questions ?? [])];
    const fromIndex = questionsInOrder.findIndex(
      (qs) => qs.question_section_id === draggedQuestionSectionId
    );

    if (fromIndex < 0) return;

    const nextOrder = [...questionsInOrder];
    const [moved] = nextOrder.splice(fromIndex, 1);

    if (position === "end" || !targetQuestionSectionId) {
      nextOrder.push(moved);
    } else {
      const toIndexOriginal = questionsInOrder.findIndex(
        (qs) => qs.question_section_id === targetQuestionSectionId
      );
      if (toIndexOriginal < 0) return;

      const toIndexAfterRemoval = fromIndex < toIndexOriginal ? toIndexOriginal - 1 : toIndexOriginal;
      const insertIndex =
        position === "after" ? toIndexAfterRemoval + 1 : toIndexAfterRemoval;

      if (insertIndex < 0) {
        nextOrder.unshift(moved);
      } else if (insertIndex >= nextOrder.length) {
        nextOrder.push(moved);
      } else {
        nextOrder.splice(insertIndex, 0, moved);
      }
    }

    const updates = nextOrder
      .map((qs, index) => ({
        question_section_id: qs.question_section_id,
        question_order: index + 1,
        previous_order: Number(qs.question_order ?? 0) || 0,
      }))
      .filter((u) => u.question_order !== u.previous_order)
      .map(({ question_section_id, question_order }) => ({ question_section_id, question_order }));

    updateQuestionSectionOrdersInSectionInState(sectionId, nextOrder);

    try {
      setIsReorderingQuestions(true);
      await persistQuestionSectionOrders(updates);
    } catch (err) {
      console.error("Failed to reorder questions", err);
    } finally {
      setIsReorderingQuestions(false);
      setDropIndicator(null);
    }
  };

  const updateDropIndicatorForTarget = (sectionId, targetQuestionSectionId, event) => {
    if (!event?.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect?.();
    if (!rect) return;
    const midY = rect.top + rect.height / 2;
    const position = event.clientY < midY ? "before" : "after";
    setDropIndicator({ sectionId, targetQuestionSectionId, position });
  };

  const updateQuestionInState = (updatedQuestion) => {
    setAssessmentDetails((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        sections: prev.sections.map((sec) => ({
          ...sec,
          section: {
            ...sec.section,
            questions: sec.section.questions.map((qs) =>
              qs.question.question_id === updatedQuestion.question_id
                ? {
                    ...qs,
                    question: {
                      ...qs.question,
                      ...updatedQuestion,
                      question_type: {
                        ...qs.question.question_type,
                        question_type_id: updatedQuestion.question_type_id,
                      },
                    },
                  }
                : qs
            ),
          },
        })),
      };
    });
  };

  const addQuestionToSection = (newQuestion, sectionId, questionSectionData = null) => {
    const hydratedQuestionType = questionTypes.find(
      (qt) => qt.question_type_id === newQuestion.question_type.question_type_id
    );

    const resolvedQuestionSectionId =
      questionSectionData?.question_section_id ?? Date.now();
    const resolvedQuestionOrder = Number(
      questionSectionData?.question_order ?? newQuestion?.question_order ?? 1
    );
    const resolvedIsRequired = Boolean(
      questionSectionData?.is_required ?? newQuestion?.is_required ?? false
    );

    setAssessmentDetails((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.section.section_id === sectionId
          ? {
              ...sec,
              section: {
                ...sec.section,
                questions: [
                  ...sec.section.questions,
                  {
                    question_section_id: resolvedQuestionSectionId,
                    question_order: resolvedQuestionOrder,
                    is_required: resolvedIsRequired,
                    question: {
                      ...newQuestion,
                      question_type: hydratedQuestionType, // ✅ THIS is the fix
                    },
                  },
                ],
              },
            }
          : sec
      ),
    }));
  };

  const updateQuestionSectionOrderInState = (questionSectionId, questionOrder) => {
    setAssessmentDetails((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        sections: prev.sections.map((sec) => ({
          ...sec,
          section: {
            ...sec.section,
            questions: sec.section.questions.map((qs) =>
              qs.question_section_id === questionSectionId
                ? {
                    ...qs,
                    question_order: Number(questionOrder),
                  }
                : qs
            ),
          },
        })),
      };
    });
  };

    const updateQuestionSectionRequiredInState = (questionSectionId, isRequired) => {
      setAssessmentDetails((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          sections: prev.sections.map((sec) => ({
            ...sec,
            section: {
              ...sec.section,
              questions: sec.section.questions.map((qs) =>
                qs.question_section_id === questionSectionId
                  ? {
                      ...qs,
                      is_required: Boolean(isRequired),
                    }
                  : qs
              ),
            },
          })),
        };
      });
    };

  const removeQuestionFromSection = (sectionId, questionSectionId) => {
    setAssessmentDetails((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.section.section_id === sectionId
          ? {
              ...sec,
              section: {
                ...sec.section,
                questions: sec.section.questions.filter(
                  (q) => q.question_section_id !== questionSectionId
                ),
              },
            }
          : sec
      ),
    }));
  };

  const removeQuestionFromConditionalSection = (sectionId, questionSectionId) => {
    const normalizedSectionId = Number(sectionId);
    if (!Number.isFinite(normalizedSectionId)) return;

    setConditionalSectionQuestions((prev) => {
      const current = prev?.[normalizedSectionId] || [];
      return {
        ...prev,
        [normalizedSectionId]: current.filter(
          (q) => q.question_section_id !== questionSectionId
        ),
      };
    });
  };

  const addQuestionToConditionalSection = (
    sectionId,
    newQuestion,
    questionSectionData,
    fallbackQuestionOrder,
    isRequired
  ) => {
    const normalizedSectionId = Number(sectionId);
    if (!Number.isFinite(normalizedSectionId)) return;

    const hydratedQuestionType =
      newQuestion?.question_type ||
      questionTypes.find(
        (qt) => qt.question_type_id === Number(newQuestion?.question_type_id)
      ) ||
      null;

    const nextQuestionSection = {
      question_section_id:
        questionSectionData?.question_section_id ?? Date.now(),
      question_order: Number(
        questionSectionData?.question_order ?? fallbackQuestionOrder ?? 1
      ),
      is_required: Boolean(
        questionSectionData?.is_required ?? isRequired ?? false
      ),
      question: {
        ...newQuestion,
        question_type: hydratedQuestionType,
      },
    };

    setConditionalSectionQuestions((prev) => {
      const current = prev?.[normalizedSectionId] || [];
      const next = [...current, nextQuestionSection].sort(compareQuestionOrder);

      return {
        ...prev,
        [normalizedSectionId]: next,
      };
    });
  };

  const getAllAssessmentQuestionIds = () => {
    const ids = new Set();

    assessmentDetails.sections.forEach((sec) => {
      sec.section.questions.forEach((qs) => {
        ids.add(qs.question.question_id);
      });
    });

    return ids;
  };

  const toggleSection = (sectionId) => {
  setExpandedSections((prev) => {
    const next = new Set(prev);
    next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
    return next;
  });
};

const isExpanded = (sectionId) => expandedSections.has(sectionId);

const getQuestionOrderValue = (questionSection) => {
  const rawOrder =
    questionSection?.question_order ??
    questionSection?.order ??
    questionSection?.question_section_order ??
    null;

  const parsed = Number(rawOrder);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isQuestionRequired = (questionSection) => {
  const rawValue =
    questionSection?.is_required ??
    questionSection?.question_section?.is_required ??
    false;

  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "number") return rawValue === 1;
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return false;
};

const compareQuestionOrder = (left, right) => {
  const leftOrder = getQuestionOrderValue(left);
  const rightOrder = getQuestionOrderValue(right);

  if (leftOrder === null && rightOrder === null) return 0;
  if (leftOrder === null) return 1;
  if (rightOrder === null) return -1;
  return leftOrder - rightOrder;
};

  const getAssessmentIsActive = (assessment) => {
    if (typeof assessment?.is_active === "boolean") return assessment.is_active;
    if (typeof assessment?.assessment?.is_active === "boolean") return assessment.assessment.is_active;
    if (typeof assessment?.active === "boolean") return assessment.active;
    return true;
  };

  const assessmentIsActive = getAssessmentIsActive(assessmentDetails);

  const isSectionConditional = (sectionWrapper) => {
    const rawValue =
      sectionWrapper?.is_conditional ??
      sectionWrapper?.section?.is_conditional ??
      false;

    if (typeof rawValue === "boolean") return rawValue;
    if (typeof rawValue === "number") return rawValue === 1;
    if (typeof rawValue === "string") {
      const normalized = rawValue.trim().toLowerCase();
      return normalized === "true" || normalized === "1";
    }

    return false;
  };

  const openEditAssessmentDetailsModal = () => {
    setEditAssessmentData({
      name: assessmentDetails?.name || "",
      description: assessmentDetails?.description || "",
      patient_instructions: assessmentDetails?.patient_instructions || "",
      patient_title: assessmentDetails?.patient_title || "",
      is_active: assessmentIsActive,
    });
    setIsEditAssessmentOpen(true);
  };

  const handleSaveAssessmentDetails = async () => {
    if (!editAssessmentData.name?.trim()) return;

    setSavingAssessmentDetails(true);
    try {
      const payload = {
        name: editAssessmentData.name,
        description: editAssessmentData.description,
        patient_instructions: editAssessmentData.patient_instructions,
        patient_title: editAssessmentData.patient_title,
        is_active: editAssessmentData.is_active,
      };

      let response = await apiRequest(
        `${process.env.REACT_APP_API_URL_BASE}/api/assessments/${id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok && response.status === 405) {
        response = await apiRequest(
          `${process.env.REACT_APP_API_URL_BASE}/api/assessments/${id}/`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Update assessment failed with status ${response.status}`);
      }

      const updated = await response.json();
      setAssessmentDetails((prev) => ({
        ...prev,
        ...updated,
        is_active:
          typeof updated?.is_active === "boolean"
            ? updated.is_active
            : !!editAssessmentData.is_active,
      }));
      setIsEditAssessmentOpen(false);
    } catch (err) {
      console.error("Failed to save assessment details", err);
    } finally {
      setSavingAssessmentDetails(false);
    }
  };


  const groupedSections =
    assessmentDetails.sections
      ?.slice()
      .sort((a, b) => a.section_order - b.section_order)
      .filter((sectionWrapper) => !isSectionConditional(sectionWrapper))
      .map(({ assessment_section_id, section_order, section }) => ({
        assessment_section_id,
        section_id: section.section_id,
        sectionOrder: section_order,
        title: section.title,
        description: section.description,
        instructions: section.instructions,
        is_conditional: Boolean(section.is_conditional),
        questions: [...(section.questions || [])].sort(compareQuestionOrder),
      })) || [];

  // const iconStyle = {
  //   cursor: "pointer",
  //   marginLeft: "12px",
  //   color: "#555",
  // };

  return (
    <div
      style={{
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: "800px", width: "100%" }}>
        <div style={{ marginBottom: "12px" }}>
          <button
            onClick={() => navigate("/assessments")}
            style={{
              padding: 0,
              background: "transparent",
              color: "#007bff",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {"< Back to Assessments"}
          </button>
        </div>

        <h1
          style={{
            textAlign: "center",
            fontSize: "2rem",
            marginBottom: "24px",
          }}
        >
          {assessmentDetails.name} Details
        </h1>

        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <button
            onClick={() => {
              setRunStartQuestionSectionId(null);
              setRunStartQuestionId(null);
              setRunForceConditionalSourceQuestionId(null);
              setRunForceConditionalTargetSectionId(null);
              setIsRunAssessmentOpen(true);
            }}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 400,
            }}
          >
            Run This Assessment
          </button>
        </div>

        <div style={{ paddingLeft: "30px" }}>
          {assessmentDetails.description && (
            <p style={{ marginBottom: "12px", color: "#666" }}>
              <strong>Description:</strong>{" "}
              {assessmentDetails.description}
            </p>
          )}

          {assessmentDetails.patient_title && (
            <p style={{ marginBottom: "12px", color: "#666" }}>
              <strong>{replacePatientText("Patient Title:", useClientTerminology)}</strong>{" "}
              {assessmentDetails.patient_title}
            </p>
          )}

          {assessmentDetails.patient_instructions && (
            <p style={{ marginBottom: "12px", color: "#666" }}>
              <strong>
                {replacePatientText("Patient Instructions:", useClientTerminology)}
              </strong>{" "}
              {assessmentDetails.patient_instructions}
            </p>
          )}

          {assessmentDetails.patient_instructions && (
              <p style={{ marginBottom: "12px", color: "#666" }}>
                <strong>Total Questions:</strong>{" "}
                {assessmentDetails.question_count}
              </p>
            )}

          <p style={{ marginBottom: "12px", color: "#666" }}>
            <strong>Status:</strong>{" "}
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: assessmentIsActive ? "#dcfce7" : "#fee2e2",
                color: assessmentIsActive ? "#166534" : "#991b1b",
              }}
            >
              {assessmentIsActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>

        <div style={{ paddingLeft: "30px", marginBottom: "20px" }}>
          <button
            onClick={openEditAssessmentDetailsModal}
            style={{
              padding: 0,
              background: "transparent",
              color: "#007bff",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            Edit Assessment Details
          </button>
        </div>

        {groupedSections.map((section) => (
          <div
            key={section.sectionOrder}
            style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <h2
                  style={{
                    fontSize: "1.5rem",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleSection(section.section_id)}
                >
                  <FontAwesomeIcon
                    icon={isExpanded(section.section_id) ? faChevronDown : faChevronRight}
                    style={{ color: "#555" }}
                  />
                  Section {section.sectionOrder}: {section.title}
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FontAwesomeIcon
                    icon={faEdit}
                    title={`Edit ${section.title} section`}
                    style={{
                      cursor: "pointer",
                      color: "#007bff",
                      fontSize: "1.2rem",
                    }}
                    onClick={() => {
                      setEditingSectionId(section.section_id);
                      setNewSectionData({
                        title: section.title,
                        description: section.description || "",
                        instructions: section.instructions || "",
                        is_conditional: Boolean(section.is_conditional),
                      });
                      setIsNewSectionOpen(true);
                    }}
                  />

                  <FontAwesomeIcon
                    icon={faTrash}
                    title={`Remove ${section.title} section`}
                    onClick={() => {
                      setDeletingSection({
                        assessment_section_id: section.assessment_section_id,
                        section_id: section.section_id,
                      });
                      setIsDeleteSectionOpen(true);
                    }}
                    style={{
                      cursor: "pointer",
                      color: "#dc3545",
                      fontSize: "1.25rem", // 👈 slightly larger than question icons
                      marginLeft: "12px",
                    }}
                  />
                </div>
              </div>
            {isExpanded(section.section_id) && (
              <div style={{ marginLeft: "40px" }}>
                {section.description && (
                  <p style={{ marginBottom: "12px", color: "#666" }}>
                    <strong>Description:</strong>{" "}
                    {section.description}
                  </p>

                )}
                {section.instructions && (
                  <p style={{ marginBottom: "12px", color: "#666" }}>
                    <strong>Instructions:</strong>{" "}
                    {section.instructions}
                  </p>

                )}

                {(() => {
                  const lastConditionalSourceInfo = (() => {
                    for (let i = section.questions.length - 1; i >= 0; i -= 1) {
                      const candidate = section.questions[i];
                      const isConditionalCandidate = isFlowRuleSourceQuestion(
                        section.section_id,
                        candidate?.question?.question_id
                      );

                      if (!isConditionalCandidate) continue;

                      const candidateRule = getFlowRuleForQuestion(
                        section.section_id,
                        candidate?.question?.question_id
                      );
                      const candidateTargetSectionId = getFlowRuleTargetSectionId(candidateRule);

                      if (!candidateTargetSectionId) continue;

                      const flowQuestions = [
                        ...(conditionalSectionQuestions?.[candidateTargetSectionId] || []),
                      ].sort(compareQuestionOrder);

                      return {
                        sourceIndex: i,
                        sourceQuestionSection: candidate,
                        targetSectionId: candidateTargetSectionId,
                        flowQuestions,
                      };
                    }

                    return null;
                  })();

                  const trailingNormalSlots = lastConditionalSourceInfo
                    ? Math.max(0, section.questions.length - lastConditionalSourceInfo.sourceIndex - 1)
                    : 0;

                  const overflowFlowQuestions = lastConditionalSourceInfo
                    ? lastConditionalSourceInfo.flowQuestions.slice(trailingNormalSlots)
                    : [];

                  const conditionalSourceIndex = lastConditionalSourceInfo?.sourceIndex ?? -1;
                  const totalConditionalCards = lastConditionalSourceInfo
                    ? (lastConditionalSourceInfo.flowQuestions?.length || 0) + 1
                    : 0;
                  const hasEvenConditionalCardCount =
                    totalConditionalCards > 0 && totalConditionalCards % 2 === 0;
                  const conditionalArrowLabelCardIndex = totalConditionalCards > 0
                    ? hasEvenConditionalCardCount
                      ? (totalConditionalCards / 2) - 1
                      : Math.floor(totalConditionalCards / 2)
                    : -1;
                  const conditionalArrowLabelTop = hasEvenConditionalCardCount ? "100%" : "50%";
                  const shouldShowConditionalFalseArrow =
                    conditionalSourceIndex >= 0 && trailingNormalSlots > 0;

                  const shouldShowOverflowCreateCard = Boolean(
                    lastConditionalSourceInfo &&
                      trailingNormalSlots <= lastConditionalSourceInfo.flowQuestions.length
                  );

                  return (

                <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column" }}>
                  {section.questions.map((qs, index) => {
                    const conditionalCardBackgroundColor = "#eef4fb";
                    const isCurrentQuestionConditional = isFlowRuleSourceQuestion(
                      section.section_id,
                      qs.question.question_id
                    );
                    const currentFlowRule = isCurrentQuestionConditional
                      ? getFlowRuleForQuestion(section.section_id, qs.question.question_id)
                      : null;
                    const currentFlowRuleCondition = getFlowRuleConditionDisplay(currentFlowRule);
                    const nearestConditionalSource = (() => {
                      for (let i = index - 1; i >= 0; i -= 1) {
                        const candidate = section.questions[i];
                        const candidateIsConditional = isFlowRuleSourceQuestion(
                          section.section_id,
                          candidate?.question?.question_id
                        );

                        if (!candidateIsConditional) continue;

                        const candidateRule = getFlowRuleForQuestion(
                          section.section_id,
                          candidate?.question?.question_id
                        );
                        const candidateTargetSectionId = getFlowRuleTargetSectionId(candidateRule);

                        if (!candidateTargetSectionId) continue;

                        return {
                          sourceIndex: i,
                          sourceQuestionSection: candidate,
                          targetSectionId: candidateTargetSectionId,
                        };
                      }

                      return null;
                    })();

                    const targetSectionId = nearestConditionalSource?.targetSectionId ?? null;
                    const conditionalFlowQuestions = targetSectionId
                      ? [...(conditionalSectionQuestions?.[targetSectionId] || [])].sort(compareQuestionOrder)
                      : [];
                    const flowSlotIndex = nearestConditionalSource
                      ? index - nearestConditionalSource.sourceIndex - 1
                      : -1;
                    const flowQuestionForRow =
                      flowSlotIndex >= 0 ? conditionalFlowQuestions[flowSlotIndex] : null;
                    const showCreateCardForRow =
                      flowSlotIndex >= 0 && flowSlotIndex === conditionalFlowQuestions.length;
                    const conditionalCardIndexForRow =
                      flowQuestionForRow
                        ? flowSlotIndex
                        : showCreateCardForRow
                          ? conditionalFlowQuestions.length
                          : -1;
                    const isLastConditionalCardForRow =
                      conditionalCardIndexForRow >= 0 &&
                      conditionalCardIndexForRow === totalConditionalCards - 1;
                    const isArrowLabelCardForRow =
                      conditionalCardIndexForRow >= 0 &&
                      conditionalCardIndexForRow === conditionalArrowLabelCardIndex;
                    const hasConditionalFlowColumn = Boolean(
                      !isCurrentQuestionConditional &&
                      nearestConditionalSource &&
                      (flowQuestionForRow || showCreateCardForRow)
                    );
                    const nextConditionalFlowOrder =
                      Math.max(
                        0,
                        ...conditionalFlowQuestions.map(
                          (flowQ) =>
                            Number(
                              flowQ?.question_order ??
                                flowQ?.order ??
                                flowQ?.question_section_order ??
                                0
                            ) || 0
                        )
                      ) + 1;

                      const normalCardOrder =
                        conditionalSourceIndex >= 0 && index > conditionalSourceIndex
                          ? index + totalConditionalCards
                          : index;

                      const conditionalCardOrder =
                        conditionalSourceIndex >= 0 && flowSlotIndex >= 0
                          ? conditionalSourceIndex + 1 + flowSlotIndex
                          : index;

                    return (
                    <React.Fragment key={qs.question_section_id}>
                    <li
                      ref={(element) => {
                        if (hasConditionalFlowColumn) {
                          if (element) {
                            normalFlowCardRefs.current[qs.question_section_id] = element;
                          } else {
                            delete normalFlowCardRefs.current[qs.question_section_id];
                          }
                        }
                      }}
                      draggable={!isReorderingQuestions}
                      onDragStart={(e) => {
                        setDraggedQuestionSectionId(qs.question_section_id);
                        setDraggedFromSectionId(section.section_id);
                        setDropIndicator({
                          sectionId: section.section_id,
                          targetQuestionSectionId: qs.question_section_id,
                          position: "before",
                        });
                        try {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "text/plain",
                            String(qs.question_section_id)
                          );
                        } catch {
                          // no-op
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedQuestionSectionId(null);
                        setDraggedFromSectionId(null);
                        setDropIndicator(null);
                      }}
                      onDragOver={(e) => {
                        if (draggedFromSectionId === section.section_id) {
                          e.preventDefault();
                          updateDropIndicatorForTarget(section.section_id, qs.question_section_id, e);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const position =
                          dropIndicator?.sectionId === section.section_id &&
                          dropIndicator?.targetQuestionSectionId === qs.question_section_id
                            ? dropIndicator.position
                            : "before";
                        moveQuestionWithinSection(section, qs.question_section_id, position);
                      }}
                      style={{
                        order: normalCardOrder,
                        position: "relative",
                        padding: "12px 16px",
                        backgroundColor: isCurrentQuestionConditional
                          ? conditionalCardBackgroundColor
                          : "#f9f9f9",
                        borderRadius: "8px",
                        boxShadow:
                          "0 2px 4px rgba(0,0,0,0.05)",
                        borderLeft:
                          "4px solid #007bff",
                        width: "100%",
                        display: "block",
                        marginBottom: "10px",
                      }}
                    >
                      {dropIndicator?.sectionId === section.section_id &&
                        dropIndicator?.targetQuestionSectionId === qs.question_section_id &&
                        dropIndicator?.position === "before" && (
                          <div
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: -6,
                              height: 3,
                              background: "#007bff",
                              borderRadius: 2,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      {dropIndicator?.sectionId === section.section_id &&
                        dropIndicator?.targetQuestionSectionId === qs.question_section_id &&
                        dropIndicator?.position === "after" && (
                          <div
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              bottom: -6,
                              height: 3,
                              background: "#007bff",
                              borderRadius: 2,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      {/* Title row with icons */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong>
                          {qs.question.title}
                          {isQuestionRequired(qs) && (
                            <span
                              aria-label="required question"
                              title="Required question"
                              style={{ color: "#dc3545", marginLeft: "4px" }}
                            >
                              *
                            </span>
                          )}
                          {isCurrentQuestionConditional && (
                            <span style={{ marginLeft: "10px", color: "#4b5563", fontWeight: 500 }}>
                              {currentFlowRuleCondition
                                ? `(Conditional: ${currentFlowRuleCondition})`
                                : "(Conditional)"}
                            </span>
                          )}
                        </strong>

                        <div>
                          <FontAwesomeIcon
                            icon={faEye}
                            title="View question"
                            style={viewIconStyle}
                            onClick={() => {
                              setRunStartQuestionSectionId(qs.question_section_id);
                              setRunStartQuestionId(qs.question.question_id);
                              setRunForceConditionalSourceQuestionId(null);
                              setRunForceConditionalTargetSectionId(null);
                              setIsRunAssessmentOpen(true);
                            }}
                          />

                          <FontAwesomeIcon
                            icon={faEdit}
                            title="Edit question"
                            style={editIconStyle}
                            onClick={() =>
                              openEditModal(
                                qs.question.question_id,
                                qs.question_section_id,
                                section.section_id,
                                qs.question_order,
                                qs?.is_required ?? qs?.question_section?.is_required ?? false
                              )
                            }
                          />

                          <FontAwesomeIcon
                            icon={faTrash}
                            title="Remove question"
                            style={editIconStyle}
                            onClick={() =>
                              setDeletingTarget({
                                section_id: section.section_id,
                                question_id: qs.question.question_id,
                                question_section_id: qs.question_section_id,
                              }) || setIsDeleteOpen(true)
                            }
                          />
                        </div>
                      </div>

                      {qs.question.question && (
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#555",
                            marginTop: "4px",
                            marginLeft: "20px",
                          }}
                        >
                          <strong>Question:</strong>{" "}
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              verticalAlign: "top",
                            }}
                          >
                            {qs.question.question}
                          </span>
                        </div>
                      )}

                      {qs.question.question_type
                        ?.description && (
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#555",
                            marginTop: "4px",
                            marginLeft: "20px",
                          }}
                        >
                          <strong>
                            Response Options:
                          </strong>{" "}
                          {qs.question.question_type.description.replace(
                            /_/g,
                            " "
                          )}
                        </div>
                      )}
                    </li>
                    {hasConditionalFlowColumn && (
                      <li
                        style={{
                          order: conditionalCardOrder,
                          width: "85%",
                          display: "block",
                          marginLeft: "auto",
                          marginBottom: "10px",
                          background: "transparent",
                          padding: 0,
                          boxShadow: "none",
                          border: "none",
                        }}
                      >
                        {flowQuestionForRow && (
                          <div
                            key={`conditional-flow-${nearestConditionalSource?.sourceQuestionSection?.question_section_id || qs.question_section_id}-${flowQuestionForRow.question_section_id}`}
                            style={{
                              position: "relative",
                              padding: "4px 16px 9px 16px",
                              marginBottom: 0,
                              backgroundColor: conditionalCardBackgroundColor,
                              borderRadius: "8px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                              borderLeft: "4px solid #93c5fd",
                            }}
                          >
                            {shouldShowConditionalFalseArrow && conditionalCardIndexForRow >= 0 && (
                              <>
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "-8.8235%",
                                    top: conditionalCardIndexForRow === 0 ? "0" : "-10px",
                                    bottom: isLastConditionalCardForRow ? "0px" : "-10px",
                                    borderLeft: "2px solid #64748b",
                                  }}
                                />
                                {isLastConditionalCardForRow && (
                                  <>
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: "-8.8235%",
                                        bottom: "-4px",
                                        width: 0,
                                        height: 0,
                                        borderLeft: "6px solid transparent",
                                        borderRight: "6px solid transparent",
                                        borderTop: "9px solid #64748b",
                                        transform: "translateX(-50%)",
                                      }}
                                    />
                                  </>
                                )}
                                {isArrowLabelCardForRow && (
                                  <>
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: "-8.8235%",
                                        top: conditionalArrowLabelTop,
                                        color: "#4b5563",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        transform: "translate(-50%, -50%)",
                                        whiteSpace: "normal",
                                        lineHeight: 1.05,
                                        textAlign: "center",
                                        backgroundColor: "#fff",
                                        padding: "1px 6px",
                                        borderRadius: "999px",
                                        zIndex: 2,
                                      }}
                                    >
                                      Default
                                      <br />
                                      Flow
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    color: "#4b5563",
                                    fontWeight: 500,
                                    fontSize: "0.72rem",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.1,
                                    marginBottom: "1px",
                                  }}
                                >
                                  (Conditional Flow)
                                </div>
                                <strong
                                  title={flowQuestionForRow?.question?.title || "Question Title"}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <span>
                                    {getConditionalFlowDisplayTitle(
                                      flowQuestionForRow?.question?.title || "Question Title"
                                    )}
                                  </span>
                                  {isQuestionRequired(flowQuestionForRow) && (
                                    <span
                                      aria-label="required question"
                                      title="Required question"
                                      style={{ color: "#dc3545" }}
                                    >
                                      *
                                    </span>
                                  )}
                                </strong>
                              </div>

                              <div>
                                <FontAwesomeIcon
                                  icon={faEye}
                                  title="View question"
                                  style={viewIconStyle}
                                  onClick={() => {
                                    const flowQuestionSectionId = Number(
                                      flowQuestionForRow?.question_section_id ??
                                        flowQuestionForRow?.question_section?.question_section_id ??
                                        0
                                    ) || null;
                                    const flowQuestionId = Number(
                                      flowQuestionForRow?.question?.question_id ??
                                        flowQuestionForRow?.question_id ??
                                        flowQuestionForRow?.question_section?.question_id ??
                                        0
                                    ) || null;

                                    setRunStartQuestionSectionId(flowQuestionSectionId);
                                    setRunStartQuestionId(flowQuestionId);
                                    setRunForceConditionalSourceQuestionId(
                                      Number(
                                        nearestConditionalSource?.sourceQuestionSection?.question?.question_id ??
                                          nearestConditionalSource?.sourceQuestionSection?.question_id ??
                                          nearestConditionalSource?.sourceQuestionSection?.question_section?.question_id ??
                                          0
                                      ) || null
                                    );
                                    setRunForceConditionalTargetSectionId(Number(targetSectionId) || null);
                                    setIsRunAssessmentOpen(true);
                                  }}
                                />

                                <FontAwesomeIcon
                                  icon={faEdit}
                                  title="Edit question"
                                  style={editIconStyle}
                                  onClick={() =>
                                    openEditModal(
                                      flowQuestionForRow?.question?.question_id,
                                      flowQuestionForRow.question_section_id,
                                      targetSectionId,
                                      flowQuestionForRow.question_order,
                                      flowQuestionForRow?.is_required ?? flowQuestionForRow?.question_section?.is_required ?? false
                                    )
                                  }
                                />

                                <FontAwesomeIcon
                                  icon={faTrash}
                                  title="Remove question"
                                  style={editIconStyle}
                                  onClick={() =>
                                    setDeletingTarget({
                                      section_id: targetSectionId,
                                      question_id: flowQuestionForRow?.question?.question_id,
                                      question_section_id: flowQuestionForRow.question_section_id,
                                    }) || setIsDeleteOpen(true)
                                  }
                                />
                              </div>
                            </div>

                            {flowQuestionForRow?.question?.question && (
                              <div
                                style={{
                                  fontSize: "0.85rem",
                                  color: "#555",
                                  marginTop: "4px",
                                  marginLeft: "20px",
                                }}
                              >
                                <strong>Question:</strong>{" "}
                                <span
                                  style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    verticalAlign: "top",
                                  }}
                                >
                                  {flowQuestionForRow.question.question}
                                </span>
                              </div>
                            )}

                            {flowQuestionForRow?.question?.question_type?.description && (
                              <div
                                style={{
                                  fontSize: "0.85rem",
                                  color: "#555",
                                  marginTop: "4px",
                                  marginLeft: "20px",
                                }}
                              >
                                <strong>Response Options:</strong>{" "}
                                {flowQuestionForRow.question.question_type.description.replace(/_/g, " ")}
                              </div>
                            )}
                          </div>
                        )}

                        {showCreateCardForRow && (
                        <div
                          style={{
                            position: "relative",
                            padding: "4px 16px 9px 16px",
                            marginBottom: 0,
                            backgroundColor: conditionalCardBackgroundColor,
                            borderRadius: "8px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            borderLeft: "4px solid #93c5fd",
                            minHeight:
                              Math.max(
                                72,
                                Math.round(
                                  (conditionalCreateCardHeights[qs.question_section_id] || 120) * 0.75
                                )
                              ),
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          {shouldShowConditionalFalseArrow && conditionalCardIndexForRow >= 0 && (
                            <>
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-8.8235%",
                                  top: conditionalCardIndexForRow === 0 ? "0" : "-10px",
                                  bottom: isLastConditionalCardForRow ? "0px" : "-10px",
                                  borderLeft: "2px solid #64748b",
                                }}
                              />
                              {isLastConditionalCardForRow && (
                                <>
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: "-8.8235%",
                                      bottom: "-4px",
                                      width: 0,
                                      height: 0,
                                      borderLeft: "6px solid transparent",
                                      borderRight: "6px solid transparent",
                                      borderTop: "9px solid #64748b",
                                      transform: "translateX(-50%)",
                                    }}
                                  />
                                </>
                              )}
                              {isArrowLabelCardForRow && (
                                <>
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: "-8.8235%",
                                      top: conditionalArrowLabelTop,
                                      color: "#4b5563",
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      transform: "translate(-50%, -50%)",
                                      whiteSpace: "normal",
                                      lineHeight: 1.05,
                                      textAlign: "center",
                                      backgroundColor: "#fff",
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      zIndex: 2,
                                    }}
                                  >
                                    Default
                                    <br />
                                    Flow
                                  </div>
                                </>
                              )}
                            </>
                          )}
                          <div
                            style={{
                              color: "#4b5563",
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              lineHeight: 1.1,
                              marginBottom: "1px",
                              whiteSpace: "nowrap",
                              alignSelf: "flex-start",
                            }}
                          >
                            (Conditional Flow)
                          </div>

                          <div
                            style={{
                              flex: 1,
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <button
                              onClick={() => {
                                setIsCreateMode(true);
                                setActiveSectionId(targetSectionId);
                                setEditingQuestion({
                                  question_section_id: null,
                                  section_id: targetSectionId,
                                  question_order: nextConditionalFlowOrder,
                                  is_required: true,
                                  title: "",
                                  question: "",
                                  hyperlink: "",
                                  is_active: true,
                                  question_type_id: questionTypes[0]?.question_type_id || "",
                                  choices: [],
                                  conditional_response_enabled: false,
                                  conditional_response_option: "",
                                  conditional_response_value: "",
                                  question_flow_rule_id: null,
                                  question_flow_rule_match_value: [],
                                  target_section_id: "",
                                  original_target_section_id: "",
                                  hide_conditional_response_controls: true,
                                });
                                setIsEditOpen(true);
                              }}
                              style={{
                                padding: "8px 14px",
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              + Create New Question
                            </button>
                          </div>
                        </div>
                        )}
                      </li>
                    )}
                    </React.Fragment>
                    );
                  })}

                  {overflowFlowQuestions.map((flowQ, overflowIndex) => (
                    <li
                      key={`conditional-overflow-${lastConditionalSourceInfo?.sourceQuestionSection?.question_section_id || section.section_id}-${flowQ.question_section_id}`}
                      style={{
                        order:
                          conditionalSourceIndex >= 0
                            ? conditionalSourceIndex + 1 + trailingNormalSlots + overflowIndex
                            : section.questions.length + overflowIndex,
                        marginBottom: "10px",
                      }}
                    >
                      {(() => {
                        const overflowConditionalCardIndex = trailingNormalSlots + overflowIndex;
                        const isOverflowArrowLabelCard =
                          overflowConditionalCardIndex === conditionalArrowLabelCardIndex;

                        return (
                      <div
                        style={{
                          width: "85%",
                          display: "block",
                          marginLeft: "auto",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            padding: "4px 16px 9px 16px",
                            backgroundColor: "#eef4fb",
                            borderRadius: "8px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            borderLeft: "4px solid #93c5fd",
                          }}
                        >
                          {shouldShowConditionalFalseArrow && (
                            <>
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-8.8235%",
                                  top: "-10px",
                                  bottom: "-10px",
                                  borderLeft: "2px solid #64748b",
                                }}
                              />
                              {isOverflowArrowLabelCard && (
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "-8.8235%",
                                    top: conditionalArrowLabelTop,
                                    color: "#4b5563",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    transform: "translate(-50%, -50%)",
                                    whiteSpace: "normal",
                                    lineHeight: 1.05,
                                    textAlign: "center",
                                    backgroundColor: "#fff",
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    zIndex: 2,
                                  }}
                                >
                                  Default
                                  <br />
                                  Flow
                                </div>
                              )}
                            </>
                          )}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  color: "#4b5563",
                                  fontWeight: 500,
                                  fontSize: "0.72rem",
                                  whiteSpace: "nowrap",
                                  lineHeight: 1.1,
                                  marginBottom: "1px",
                                }}
                              >
                                (Conditional Flow)
                              </div>
                              <strong
                                title={flowQ?.question?.title || "Question Title"}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span>
                                  {getConditionalFlowDisplayTitle(
                                    flowQ?.question?.title || "Question Title"
                                  )}
                                </span>
                                {isQuestionRequired(flowQ) && (
                                  <span
                                    aria-label="required question"
                                    title="Required question"
                                    style={{ color: "#dc3545" }}
                                  >
                                    *
                                  </span>
                                )}
                              </strong>
                            </div>

                            <div>
                              <FontAwesomeIcon
                                icon={faEye}
                                title="View question"
                                style={viewIconStyle}
                                onClick={() => {
                                  const flowQuestionSectionId = Number(
                                    flowQ?.question_section_id ??
                                      flowQ?.question_section?.question_section_id ??
                                      0
                                  ) || null;
                                  const flowQuestionId = Number(
                                    flowQ?.question?.question_id ??
                                      flowQ?.question_id ??
                                      flowQ?.question_section?.question_id ??
                                      0
                                  ) || null;

                                  setRunStartQuestionSectionId(flowQuestionSectionId);
                                  setRunStartQuestionId(flowQuestionId);
                                  setRunForceConditionalSourceQuestionId(
                                    Number(
                                      lastConditionalSourceInfo?.sourceQuestionSection?.question?.question_id ??
                                        lastConditionalSourceInfo?.sourceQuestionSection?.question_id ??
                                        lastConditionalSourceInfo?.sourceQuestionSection?.question_section?.question_id ??
                                        0
                                    ) || null
                                  );
                                  setRunForceConditionalTargetSectionId(
                                    Number(lastConditionalSourceInfo?.targetSectionId) || null
                                  );
                                  setIsRunAssessmentOpen(true);
                                }}
                              />

                              <FontAwesomeIcon
                                icon={faEdit}
                                title="Edit question"
                                style={editIconStyle}
                                onClick={() =>
                                  openEditModal(
                                    flowQ?.question?.question_id,
                                    flowQ.question_section_id,
                                    lastConditionalSourceInfo?.targetSectionId,
                                    flowQ.question_order,
                                    flowQ?.is_required ?? flowQ?.question_section?.is_required ?? false
                                  )
                                }
                              />

                              <FontAwesomeIcon
                                icon={faTrash}
                                title="Remove question"
                                style={editIconStyle}
                                onClick={() =>
                                  setDeletingTarget({
                                    section_id: lastConditionalSourceInfo?.targetSectionId,
                                    question_id: flowQ?.question?.question_id,
                                    question_section_id: flowQ.question_section_id,
                                  }) || setIsDeleteOpen(true)
                                }
                              />
                            </div>
                          </div>

                          {flowQ?.question?.question && (
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "#555",
                                marginTop: "4px",
                                marginLeft: "20px",
                              }}
                            >
                              <strong>Question:</strong>{" "}
                              <span
                                style={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  verticalAlign: "top",
                                }}
                              >
                                {flowQ.question.question}
                              </span>
                            </div>
                          )}

                          {flowQ?.question?.question_type?.description && (
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "#555",
                                marginTop: "4px",
                                marginLeft: "20px",
                              }}
                            >
                              <strong>Response Options:</strong>{" "}
                              {flowQ.question.question_type.description.replace(/_/g, " ")}
                            </div>
                          )}
                        </div>
                      </div>
                        );
                      })()}
                    </li>
                  ))}

                  {shouldShowOverflowCreateCard && (
                    <li
                      style={{
                        order:
                          conditionalSourceIndex >= 0
                            ? conditionalSourceIndex + 1 + trailingNormalSlots + overflowFlowQuestions.length
                            : section.questions.length + overflowFlowQuestions.length,
                        marginBottom: "10px",
                      }}
                    >
                      {(() => {
                        const overflowCreateCardIndex = trailingNormalSlots + overflowFlowQuestions.length;
                        const isOverflowCreateArrowLabelCard =
                          overflowCreateCardIndex === conditionalArrowLabelCardIndex;

                        return (
                      <div
                        style={{
                          width: "85%",
                          display: "block",
                          marginLeft: "auto",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            padding: "4px 16px 9px 16px",
                            backgroundColor: "#eef4fb",
                            borderRadius: "8px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                            borderLeft: "4px solid #93c5fd",
                            minHeight: 90,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                          }}
                        >
                          {shouldShowConditionalFalseArrow && (
                            <>
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-8.8235%",
                                  top: "-10px",
                                  bottom: "0px",
                                  borderLeft: "2px solid #64748b",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-8.8235%",
                                  bottom: "-4px",
                                  width: 0,
                                  height: 0,
                                  borderLeft: "6px solid transparent",
                                  borderRight: "6px solid transparent",
                                  borderTop: "9px solid #64748b",
                                  transform: "translateX(-50%)",
                                }}
                              />
                              {isOverflowCreateArrowLabelCard && (
                                <div
                                  style={{
                                    position: "absolute",
                                    left: "-8.8235%",
                                    top: "50%",
                                    color: "#4b5563",
                                    fontSize: "0.8rem",
                                    fontWeight: 600,
                                    transform: "translate(-50%, -50%)",
                                    whiteSpace: "normal",
                                    lineHeight: 1.05,
                                    textAlign: "center",
                                    backgroundColor: "#fff",
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    zIndex: 2,
                                  }}
                                >
                                  Default
                                  <br />
                                  Flow
                                </div>
                              )}
                            </>
                          )}
                          <div
                            style={{
                              color: "#4b5563",
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              lineHeight: 1.1,
                              marginBottom: "1px",
                              whiteSpace: "nowrap",
                              alignSelf: "flex-start",
                            }}
                          >
                            (Conditional Flow)
                          </div>

                          <div
                            style={{
                              flex: 1,
                              width: "100%",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <button
                              onClick={() => {
                                setIsCreateMode(true);
                                setActiveSectionId(lastConditionalSourceInfo?.targetSectionId);
                                setEditingQuestion({
                                  question_section_id: null,
                                  section_id: lastConditionalSourceInfo?.targetSectionId,
                                  question_order:
                                    Math.max(
                                      0,
                                      ...((lastConditionalSourceInfo?.flowQuestions || []).map(
                                        (flowQuestion) =>
                                          Number(
                                            flowQuestion?.question_order ??
                                              flowQuestion?.order ??
                                              flowQuestion?.question_section_order ??
                                              0
                                          ) || 0
                                      ))
                                    ) + 1,
                                  is_required: true,
                                  title: "",
                                  question: "",
                                  hyperlink: "",
                                  is_active: true,
                                  question_type_id: questionTypes[0]?.question_type_id || "",
                                  choices: [],
                                  conditional_response_enabled: false,
                                  conditional_response_option: "",
                                  conditional_response_value: "",
                                  question_flow_rule_id: null,
                                  question_flow_rule_match_value: [],
                                  target_section_id: "",
                                  original_target_section_id: "",
                                  hide_conditional_response_controls: true,
                                });
                                setIsEditOpen(true);
                              }}
                              style={{
                                padding: "8px 14px",
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              + Create New Question
                            </button>
                          </div>
                        </div>
                      </div>
                        );
                      })()}
                    </li>
                  )}

                </ul>

                  );
                })()}

                <div
                  onDragOver={(e) => {
                    if (draggedFromSectionId === section.section_id) {
                      e.preventDefault();
                      setDropIndicator({
                        sectionId: section.section_id,
                        targetQuestionSectionId: null,
                        position: "end",
                      });
                    }
                  }}
                  onDrop={(e) => {
                    if (draggedFromSectionId === section.section_id) {
                      e.preventDefault();
                      moveQuestionWithinSection(section, null, "end");
                    }
                  }}
                  style={{
                    position: "relative",
                    height: "10px",
                    marginTop: "-6px",
                    marginBottom: "10px",
                  }}
                >
                  {dropIndicator?.sectionId === section.section_id &&
                    dropIndicator?.position === "end" && (
                      <div
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: 3,
                          height: 3,
                          background: "#007bff",
                          borderRadius: 2,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                </div>
                <div style={{ marginTop: "12px", textAlign: "right" }}>
                  <button
                    onClick={() => {
                      const nextOrder =
                        Math.max(
                          0,
                          ...section.questions.map((q) => q.question_order || 0)
                        ) + 1;

                      setIsCreateMode(true);
                      setActiveSectionId(section.section_id);
                      setEditingQuestion({
                        question_section_id: null,
                        section_id: section.section_id,
                        question_order: nextOrder,
                        is_required: true,
                        title: "",
                        question: "",
                        hyperlink: "",
                        is_active: true,
                        question_type_id: questionTypes[0]?.question_type_id || "",
                        choices: [],
                        conditional_response_enabled: false,
                        conditional_response_option: "",
                        conditional_response_value: "",
                        question_flow_rule_id: null,
                        question_flow_rule_match_value: [],
                        target_section_id: "",
                        original_target_section_id: "",
                        hide_conditional_response_controls: false,
                      });
                      setIsEditOpen(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    + Create New Question
                  </button>
                  <button
                    onClick={async () => {
                      setActiveSectionId(section.section_id);

                      const res = await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/questions/`
                      );
                      const allQuestions = await res.json();

                      const usedQuestionIds = getAllAssessmentQuestionIds();
                      setExistingQuestions(
                        allQuestions.filter(
                          (q) => !usedQuestionIds.has(q.question_id)
                        )
                      );

                      setSelectedExistingQuestionId(null);
                      setIsAddExistingOpen(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#6c757d",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      marginLeft: "8px",
                    }}
                  >
                    + Add Existing Question
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isEditAssessmentOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1350,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "560px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "16px" }}>Edit Assessment Details</h3>

              <div style={{ marginBottom: "12px" }}>
                <label>Name</label>
                <input
                  type="text"
                  value={editAssessmentData.name}
                  onChange={(e) =>
                    setEditAssessmentData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label>Description</label>
                <textarea
                  rows={2}
                  value={editAssessmentData.description}
                  onChange={(e) =>
                    setEditAssessmentData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label>
                  {replacePatientText("Patient Instructions", useClientTerminology)}
                </label>
                <textarea
                  rows={2}
                  value={editAssessmentData.patient_instructions}
                  onChange={(e) =>
                    setEditAssessmentData((prev) => ({ ...prev, patient_instructions: e.target.value }))
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label>
                  {replacePatientText("Patient Title", useClientTerminology)}
                </label>
                <input
                  type="text"
                  value={editAssessmentData.patient_title}
                  onChange={(e) =>
                    setEditAssessmentData((prev) => ({ ...prev, patient_title: e.target.value }))
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={!!editAssessmentData.is_active}
                    onChange={(e) =>
                      setEditAssessmentData((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => setIsEditAssessmentOpen(false)}
                  disabled={savingAssessmentDetails}
                >
                  Cancel
                </button>
                <button
                  style={{
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={handleSaveAssessmentDetails}
                  disabled={savingAssessmentDetails || !editAssessmentData.name?.trim()}
                >
                  {savingAssessmentDetails ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          {/* <div style={{ textAlign: "center", marginTop: "24px" }}> */}
        <button
          onClick={() => {
            setNewSectionData({ title: "", description: "", instructions: "", is_conditional: false });
            setIsNewSectionOpen(true);
          }}
          style={{
            padding: "8px 16px",
            background: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "8px",
          }}
        >
          + Create New Section
        </button>

        </div>


      </div>

        {isDeleteOpen && deletingTarget && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1100,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "420px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "12px", color: "#dc3545" }}>
                Remove Question
              </h3>

              <p style={{ marginBottom: "20px", color: "#444" }}>
                Are you sure you want to remove this question from this assessment?
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  onClick={() => {
                    setIsDeleteOpen(false);
                    setDeletingTarget(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  style={{
                    background: "#dc3545",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    try {
                      await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/${deletingTarget.question_section_id}/`,
                        { method: "DELETE" }
                      );

                      const isMainAssessmentSection = assessmentDetails.sections.some(
                        (sec) =>
                          Number(sec?.section?.section_id) ===
                          Number(deletingTarget.section_id)
                      );

                      if (isMainAssessmentSection) {
                        removeQuestionFromSection(
                          deletingTarget.section_id,
                          deletingTarget.question_section_id
                        );
                      } else {
                        removeQuestionFromConditionalSection(
                          deletingTarget.section_id,
                          deletingTarget.question_section_id
                        );
                      }
                    } catch (err) {
                      console.error("Delete failed", err);
                    } finally {
                      setIsDeleteOpen(false);
                      setDeletingTarget(null);
                    }
                  }}
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {isEditOpen && editingQuestion && (
          <QuestionModal
            isOpen={isEditOpen}
            isCreateMode={isCreateMode}
            editingQuestion={editingQuestion}
            setEditingQuestion={setEditingQuestion}
            questionTypes={questionTypes}
            conditionalSections={conditionalSections}
            selectedQuestionType={selectedQuestionType}
            saving={saving}
            onCancel={() => {
              setIsEditOpen(false);
              setIsCreateMode(false);
              setActiveSectionId(null);
            }}
            onSave={async (conditionalResponseData) => {
              setSaving(true);

              try {
                const selectedType = questionTypes.find(
                  (qt) => qt.question_type_id === Number(editingQuestion.question_type_id)
                );
                const isPerformTaskVideo =
                  String(selectedType?.description ?? "").trim().toLowerCase() ===
                  "perform_task_video";
                const parsedQuestionOrder = Number(editingQuestion.question_order);
                const normalizedQuestionOrder =
                  Number.isFinite(parsedQuestionOrder) && parsedQuestionOrder > 0
                    ? parsedQuestionOrder
                    : null;
                const conditionalResponseEnabled = Boolean(
                  conditionalResponseData?.isConditionalResponseEnabled
                );
                const conditionalOptionToDisplay = String(
                  conditionalResponseData?.conditionalOptionToDisplay ?? ""
                ).trim();
                const conditionalValueRaw = String(
                  conditionalResponseData?.conditionalValue ?? ""
                ).trim();
                const parsedTargetSectionId = Number(
                  conditionalResponseData?.conditionalTargetSectionId
                );
                const normalizedTargetSectionId =
                  Number.isFinite(parsedTargetSectionId) && parsedTargetSectionId > 0
                    ? parsedTargetSectionId
                    : 1;
                const hasConditionalResponseValues =
                  conditionalOptionToDisplay.length > 0 && conditionalValueRaw.length > 0;
                const parsedConditionalValue = Number(conditionalValueRaw);
                const normalizedConditionalValue =
                  conditionalValueRaw.length === 0
                    ? ""
                    : Number.isFinite(parsedConditionalValue)
                      ? parsedConditionalValue
                      : conditionalValueRaw;
                const nextMatchValue = hasConditionalResponseValues
                  ? [
                      {
                        value: normalizedConditionalValue,
                        option: conditionalOptionToDisplay,
                      },
                    ]
                  : [];
                const previousFlowRuleId = getFlowRuleId({
                  flow_rule_id: editingQuestion.question_flow_rule_id,
                });
                const previousTargetSectionId = Number(
                  editingQuestion.original_target_section_id
                );
                const previousMatchValue = toFlowRuleMatchValueArray(
                  editingQuestion.question_flow_rule_match_value
                );
                let savedQuestionId = Number(editingQuestion.question_id);
                let savedSectionId = Number(
                  editingQuestion.section_id ?? activeSectionId
                );
                let resultingFlowRuleId = previousFlowRuleId;
                let resultingFlowRuleMatchValue = previousMatchValue;

                const payload = {
                  title: editingQuestion.title,
                  question: editingQuestion.question,
                  is_active: editingQuestion.is_active,
                  question_type_id: editingQuestion.question_type_id,
                  use_default_options: editingQuestion.use_default_options,
                  choices: editingQuestion.use_default_options
                    ? []
                    : editingQuestion.choices,
                  ...(isPerformTaskVideo
                    ? { hyperlink: String(editingQuestion.hyperlink ?? "").trim() }
                    : {}),
                };

                if (isCreateMode) {
                  const res = await apiRequest(
                    `${process.env.REACT_APP_API_URL_BASE}/api/questions/`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    }
                  );

                  const questionData = await res.json();

                  const qsRes = await apiRequest(
                    `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        section_id: activeSectionId,
                        question_id: questionData.question_id,
                        question_order: normalizedQuestionOrder,
                        is_required: Boolean(editingQuestion.is_required),
                      }),
                    }
                  );

                  const questionSectionData = await qsRes.json();
                  savedQuestionId = Number(questionData.question_id);
                  savedSectionId = Number(activeSectionId);

                  const isMainAssessmentSection = assessmentDetails.sections.some(
                    (sec) =>
                      Number(sec?.section?.section_id) === Number(activeSectionId)
                  );

                  if (isMainAssessmentSection) {
                    addQuestionToSection(
                      {
                        ...questionData,
                        question_order: normalizedQuestionOrder,
                      },
                      activeSectionId,
                      questionSectionData
                    );
                  } else {
                    addQuestionToConditionalSection(
                      activeSectionId,
                      {
                        ...questionData,
                        question_order: normalizedQuestionOrder,
                      },
                      questionSectionData,
                      normalizedQuestionOrder,
                      editingQuestion.is_required
                    );
                  }
                } else {
                  const res = await apiRequest(
                    `${process.env.REACT_APP_API_URL_BASE}/api/questions/${editingQuestion.question_id}/`,
                    {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    }
                  );

                  const updated = await res.json();
                  updateQuestionInState(updated);

                  const isMainAssessmentSection = assessmentDetails.sections.some(
                    (sec) =>
                      Number(sec?.section?.section_id) ===
                      Number(editingQuestion.section_id)
                  );

                  if (!isMainAssessmentSection) {
                    setConditionalSectionQuestions((prev) => {
                      const sectionId = Number(editingQuestion.section_id);
                      const current = prev?.[sectionId] || [];
                      const next = current.map((flowQ) => {
                        if (Number(flowQ?.question?.question_id) !== Number(updated?.question_id)) {
                          return flowQ;
                        }

                        return {
                          ...flowQ,
                          question: {
                            ...flowQ.question,
                            ...updated,
                            question_type:
                              updated?.question_type ||
                              flowQ?.question?.question_type ||
                              flowQ?.question_type,
                          },
                        };
                      });

                      return {
                        ...prev,
                        [sectionId]: next,
                      };
                    });
                  }

                  if (editingQuestion.question_section_id) {
                    await apiRequest(
                      `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/${editingQuestion.question_section_id}/`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          question_order: normalizedQuestionOrder,
                          is_required: Boolean(editingQuestion.is_required),
                        }),
                      }
                    );

                    updateQuestionSectionOrderInState(
                      editingQuestion.question_section_id,
                      normalizedQuestionOrder
                    );

                    updateQuestionSectionRequiredInState(
                      editingQuestion.question_section_id,
                      editingQuestion.is_required
                    );

                    if (!isMainAssessmentSection) {
                      const sectionId = Number(editingQuestion.section_id);
                      setConditionalSectionQuestions((prev) => {
                        const current = prev?.[sectionId] || [];
                        const next = current
                          .map((flowQ) =>
                            flowQ.question_section_id === editingQuestion.question_section_id
                              ? {
                                  ...flowQ,
                                  question_order: normalizedQuestionOrder,
                                  is_required: Boolean(editingQuestion.is_required),
                                }
                              : flowQ
                          )
                          .sort(compareQuestionOrder);

                        return {
                          ...prev,
                          [sectionId]: next,
                        };
                      });
                    }
                  }
                }

                if (
                  conditionalResponseEnabled &&
                  Number.isFinite(savedQuestionId) &&
                  Number.isFinite(savedSectionId)
                ) {
                  if (previousFlowRuleId) {
                    const hasMatchValueChanged =
                      JSON.stringify(previousMatchValue) !==
                      JSON.stringify(nextMatchValue);
                    const hasTargetSectionChanged =
                      Number.isFinite(previousTargetSectionId)
                        ? previousTargetSectionId !== normalizedTargetSectionId
                        : true;

                    if ((hasConditionalResponseValues && hasMatchValueChanged) || hasTargetSectionChanged) {
                      const patchPayload = {};
                      if (hasConditionalResponseValues && hasMatchValueChanged) {
                        patchPayload.match_value = nextMatchValue;
                      }
                      if (hasTargetSectionChanged) {
                        patchPayload.target_section_id = normalizedTargetSectionId;
                      }

                      const patchRuleRes = await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/question-flow-rules/${previousFlowRuleId}/`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(patchPayload),
                        }
                      );

                      if (patchRuleRes.ok) {
                        const patchedRule = await patchRuleRes.json();
                        resultingFlowRuleId = getFlowRuleId(patchedRule) ?? previousFlowRuleId;
                        resultingFlowRuleMatchValue = hasMatchValueChanged
                          ? toFlowRuleMatchValueArray(patchedRule?.match_value)
                          : previousMatchValue;
                        setQuestionFlowRules((prev) =>
                          (prev || []).map((rule) =>
                            getFlowRuleId(rule) === previousFlowRuleId
                              ? { ...rule, ...patchedRule }
                              : rule
                          )
                        );
                      }
                    }
                  } else if (hasConditionalResponseValues) {
                    const createRuleRes = await apiRequest(
                      `${process.env.REACT_APP_API_URL_BASE}/api/question-flow-rules/`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          assessment_id: Number(id),
                          source_section_id: savedSectionId,
                          source_question_id: savedQuestionId,
                          target_section_id: normalizedTargetSectionId,
                          target_question_id: 1,
                          match_value: nextMatchValue,
                          priority: 1,
                          is_active: true,
                        }),
                      }
                    );

                    if (createRuleRes.ok) {
                      const createdRule = await createRuleRes.json();
                      resultingFlowRuleId = getFlowRuleId(createdRule);
                      resultingFlowRuleMatchValue =
                        toFlowRuleMatchValueArray(createdRule?.match_value);
                      setQuestionFlowRules((prev) => [...(prev || []), createdRule]);
                    }
                  }
                }

                if (!conditionalResponseEnabled && previousFlowRuleId) {
                  const deleteRuleRes = await apiRequest(
                    `${process.env.REACT_APP_API_URL_BASE}/api/question-flow-rules/${previousFlowRuleId}/`,
                    {
                      method: "DELETE",
                    }
                  );

                  if (deleteRuleRes.ok) {
                    resultingFlowRuleId = null;
                    resultingFlowRuleMatchValue = [];
                    setQuestionFlowRules((prev) =>
                      (prev || []).filter(
                        (rule) => getFlowRuleId(rule) !== previousFlowRuleId
                      )
                    );
                  }
                }

                setEditingQuestion((prev) =>
                  prev
                    ? {
                        ...prev,
                        conditional_response_enabled: conditionalResponseEnabled,
                        conditional_response_option: conditionalOptionToDisplay,
                        conditional_response_value: conditionalValueRaw,
                        question_flow_rule_id: resultingFlowRuleId,
                        question_flow_rule_match_value: resultingFlowRuleMatchValue,
                        target_section_id: normalizedTargetSectionId,
                        original_target_section_id: normalizedTargetSectionId,
                      }
                    : prev
                );

                setIsEditOpen(false);
                setIsCreateMode(false);
                setActiveSectionId(null);
              } catch (err) {
                console.error("Save failed", err);
              } finally {
                setSaving(false);
              }
            }}
          />

        )}

        {isNewSectionOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1300,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "500px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "16px" }}>
                {editingSectionId ? "Edit Section" : "Create New Section"}
              </h3>

              <div style={{ marginBottom: "12px" }}>
                <label>Title</label>
                <input
                  type="text"
                  value={newSectionData.title}
                  onChange={(e) =>
                    setNewSectionData({ ...newSectionData, title: e.target.value })
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label>Description</label>
                <textarea
                  rows={2}
                  value={newSectionData.description}
                  onChange={(e) =>
                    setNewSectionData({ ...newSectionData, description: e.target.value })
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label>Instructions</label>
                <textarea
                  rows={2}
                  value={newSectionData.instructions}
                  onChange={(e) =>
                    setNewSectionData({ ...newSectionData, instructions: e.target.value })
                  }
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(newSectionData.is_conditional)}
                    onChange={(e) =>
                      setNewSectionData({
                        ...newSectionData,
                        is_conditional: e.target.checked,
                      })
                    }
                  />
                  Conditional Section
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setIsNewSectionOpen(false);
                    setEditingSectionId(null);
                    setNewSectionData({ title: "", description: "", instructions: "", is_conditional: false });
                  }}
                >
                  Cancel
                </button>

                <button
                  style={{
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    try {
                      if (editingSectionId) {
                        // ✏️ EDIT SECTION (PUT)
                        const res = await apiRequest(
                          `${process.env.REACT_APP_API_URL_BASE}/api/sections/${editingSectionId}/`,
                          {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(newSectionData),
                          }
                        );

                        const updatedSection = await res.json();

                        // 🔄 Update UI
                        setAssessmentDetails((prev) => ({
                          ...prev,
                          sections: prev.sections.map((s) =>
                            s.section.section_id === editingSectionId
                              ? { ...s, section: { ...s.section, ...updatedSection } }
                              : s
                          ),
                        }));
                      } else {
                        // ➕ CREATE SECTION (POST)
                        const sectionRes = await apiRequest(
                          `${process.env.REACT_APP_API_URL_BASE}/api/sections/`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(newSectionData),
                          }
                        );

                        const sectionData = await sectionRes.json();

                        if (!newSectionData.is_conditional) {
                          const nextOrder =
                            Math.max(0, ...assessmentDetails.sections.map((s) => s.section_order)) + 1;

                          await apiRequest(
                            `${process.env.REACT_APP_API_URL_BASE}/api/assessment-sections/`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                assessment_id: id,
                                section_id: sectionData.section_id,
                                section_order: nextOrder,
                              }),
                            }
                          );

                          setAssessmentDetails((prev) => ({
                            ...prev,
                            sections: [
                              ...prev.sections,
                              {
                                section_order: nextOrder,
                                section: {
                                  ...sectionData,
                                  questions: [],
                                },
                              },
                            ],
                          }));
                        }
                      }

                      // 🧹 Cleanup
                      setIsNewSectionOpen(false);
                      setEditingSectionId(null);
                      setNewSectionData({ title: "", description: "", instructions: "", is_conditional: false });
                    } catch (err) {
                      console.error("Failed to save section", err);
                    }
                  }}

                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {isAddExistingSectionOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1400,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "500px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "16px" }}>Add Existing Section</h3>

              <div style={{ marginBottom: "16px" }}>
                <label>Select Section</label>
                <select
                  value={selectedExistingSectionId || ""}
                  onChange={(e) => setSelectedExistingSectionId(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="">-- Select a section --</option>
                  {existingSections.map((s) => (
                    <option key={s.section_id} value={s.section_id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setIsAddExistingSectionOpen(false);
                    setSelectedExistingSectionId(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  disabled={!selectedExistingSectionId}
                  style={{
                    background: "#6c757d",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    try {
                      const sectionToAdd = existingSections.find(
                        (s) => s.section_id === selectedExistingSectionId
                      );

                      // Determine next section_order
                      const nextOrder =
                        Math.max(0, ...assessmentDetails.sections.map((s) => s.section_order)) + 1;

                      // Attach section to assessment
                      const res = await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/assessment-sections/`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            assessment_id: id,
                            section_id: selectedExistingSectionId,
                            section_order: nextOrder,
                          }),
                        }
                      );
                      await res.json();
                      // Update UI
                      setAssessmentDetails((prev) => ({
                        ...prev,
                        sections: [
                          ...prev.sections,
                          {
                            section_order: nextOrder,
                            section: {
                              ...sectionToAdd,
                              questions: [],
                            },
                          },
                        ],
                      }));

                      setIsAddExistingSectionOpen(false);
                      setSelectedExistingSectionId(null);
                    } catch (err) {
                      console.error("Failed to add existing section", err);
                    }
                  }}
                >
                  Add Section
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteSectionOpen && deletingSection && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1300,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "440px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "12px", color: "#dc3545" }}>
                Remove Section
              </h3>

              <p style={{ marginBottom: "20px", color: "#444" }}>
                Are you sure you want to remove this section from this assessment?
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  onClick={() => {
                    setIsDeleteSectionOpen(false);
                    setDeletingSection(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  style={{
                    background: "#dc3545",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    if (!deletingSection.assessment_section_id) {
                      console.error("assessment_section_id not found");
                      return;
                    }

                    try {
                      await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/assessment-sections/${deletingSection.assessment_section_id}/`,
                        { method: "DELETE" }
                      );

                      // Update UI immediately
                      setAssessmentDetails((prev) => ({
                        ...prev,
                        sections: prev.sections.filter(
                          (s) => s.assessment_section_id !== deletingSection.assessment_section_id
                        ),
                      }));
                    } catch (err) {
                      console.error("Failed to remove section", err);
                    } finally {
                      setIsDeleteSectionOpen(false);
                      setDeletingSection(null);
                    }
                  }}

                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {isAddExistingOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1200,
            }}
          >
            <div
              style={{
                background: "#fff",
                padding: "24px",
                width: "520px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <h3 style={{ marginBottom: "16px" }}>Add Existing Question</h3>

              <div style={{ marginBottom: "16px" }}>
                <label>Select Question</label>
                <select
                  value={selectedExistingQuestionId || ""}
                  onChange={(e) =>
                    setSelectedExistingQuestionId(Number(e.target.value))
                  }
                  style={{ width: "100%", padding: "8px" }}
                >
                  <option value="">-- Select a question --</option>
                  {existingQuestions.map((q) => (
                    <option key={q.question_id} value={q.question_id}>
                      {q.question}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  onClick={() => {
                    setIsAddExistingOpen(false);
                    setActiveSectionId(null);
                  }}
                >
                  Cancel
                </button>

                <button
                  disabled={!selectedExistingQuestionId}
                  style={{
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    try {
                      const section = assessmentDetails.sections.find(
                        (s) => s.section.section_id === activeSectionId
                      );

                      const nextOrder =
                        Math.max(
                          0,
                          ...section.section.questions.map(
                            (q) => q.question_order || 0
                          )
                        ) + 1;

                      const res = await apiRequest(
                        `${process.env.REACT_APP_API_URL_BASE}/api/question-sections/`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            section_id: activeSectionId,
                            question_id: selectedExistingQuestionId,
                            question_order: nextOrder,
                          }),
                        }
                      );

                      const qsData = await res.json();

                      const question = existingQuestions.find(
                        (q) => q.question_id === selectedExistingQuestionId
                      );

                      // 🔥 Update UI immediately
                      setAssessmentDetails((prev) => ({
                        ...prev,
                        sections: prev.sections.map((sec) =>
                          sec.section.section_id === activeSectionId
                            ? {
                                ...sec,
                                section: {
                                  ...sec.section,
                                  questions: [
                                    ...sec.section.questions,
                                    {
                                      question_section_id:
                                        qsData.question_section_id,
                                      question_order: nextOrder,
                                      question,
                                    },
                                  ],
                                },
                              }
                            : sec
                        ),
                      }));

                      setIsAddExistingOpen(false);
                      setActiveSectionId(null);
                    } catch (err) {
                      console.error("Failed to add existing question", err);
                    }
                  }}
                >
                  Add Question
                </button>
              </div>
            </div>
          </div>
        )}

        <RunAssessment
          isOpen={isRunAssessmentOpen}
          onClose={() => setIsRunAssessmentOpen(false)}
          assessmentName={assessmentDetails?.name}
          assessmentId={Number(assessmentDetails?.assessment_id ?? id ?? 0) || null}
          shouldPersistAssessmentResponses={false}
          patientId={Number.isFinite(runPatientId) && runPatientId > 0 ? runPatientId : null}
          patientEventId={
            Number.isFinite(runPatientEventId) && runPatientEventId > 0
              ? runPatientEventId
              : null
          }
          sections={groupedSections}
          startQuestionSectionId={runStartQuestionSectionId}
          startQuestionId={runStartQuestionId}
          forceConditionalSourceQuestionId={runForceConditionalSourceQuestionId}
          forceConditionalTargetSectionId={runForceConditionalTargetSectionId}
        />
      </div>
  );
}

export default AssessmentDetails;
