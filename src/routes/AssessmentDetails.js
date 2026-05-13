// src/routes/Priorities.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import QuestionModal from "./QuestionModal";
import RunAssessment from "./RunAssessment";
import CognitrackXReportExample from "./CognitrackXReportExample";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { apiRequest } from "../api";
import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";

// Font Awesome
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEdit, faTrash, faChevronDown, faChevronRight  } from "@fortawesome/free-solid-svg-icons";

const calculationRuleFieldOrder = ["rule_id", "type", "qid_1", "qid_2"];

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeQuestionTypeDescription = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isSignatureAgreementQuestionType = (questionTypeId, description) =>
  Number(questionTypeId) === 33 ||
  normalizeQuestionTypeDescription(description) === "signature_agreement";

const serializeQuestionChoicesJson = (choices) => {
  if (typeof choices === "string") {
    try {
      return JSON.stringify(JSON.parse(choices), null, 2);
    } catch {
      return choices;
    }
  }

  return JSON.stringify(choices ?? [], null, 2);
};

const renderHighlightedDescriptionText = (text, labels) => {
  const normalizedText = String(text ?? "");
  const filteredLabels = Array.from(
    new Set(
      (labels || [])
        .map((label) => String(label ?? "").trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length)
    )
  );

  if (!normalizedText || !filteredLabels.length) {
    return normalizedText;
  }

  const matcher = new RegExp(`(${filteredLabels.map(escapeRegExp).join("|")})`, "ig");
  const parts = normalizedText.split(matcher);

  return parts.map((part, index) => {
    const isMatch = filteredLabels.some((label) => label.toLowerCase() === part.toLowerCase());
    return isMatch ? <strong key={`highlight-${index}`}>{part}</strong> : part;
  });
};

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
  const [isExampleReportOpen, setIsExampleReportOpen] = useState(false);
  const [isDownloadingExampleReport, setIsDownloadingExampleReport] = useState(false);
  const [runStartQuestionSectionId, setRunStartQuestionSectionId] = useState(null);
  const [runStartQuestionId, setRunStartQuestionId] = useState(null);
  const [runForceConditionalSourceQuestionId, setRunForceConditionalSourceQuestionId] = useState(null);
  const [runForceConditionalTargetSectionId, setRunForceConditionalTargetSectionId] = useState(null);
  const [isCalculationRuleModalOpen, setIsCalculationRuleModalOpen] = useState(false);
  const [calculationRuleDraft, setCalculationRuleDraft] = useState(null);
  const [savingCalculationRule, setSavingCalculationRule] = useState(false);
  const [activeCalculationRuleQuestionTitle, setActiveCalculationRuleQuestionTitle] = useState("");
  const [calculationRuleOptions, setCalculationRuleOptions] = useState([]);
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
  const exampleReportRef = useRef(null);




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

  const addToTotalPillStyle = {
    marginLeft: "10px",
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  };

  const calculatedValuePillStyle = {
    ...addToTotalPillStyle,
    background: "#e0f2fe",
    color: "#0369a1",
  };

  const mergeQuestionSectionFlagsIntoAssessmentDetails = (assessmentData, questionSectionRows) => {
    if (!assessmentData?.sections || !Array.isArray(questionSectionRows)) {
      return assessmentData;
    }

    const questionSectionById = new Map(
      questionSectionRows
        .map((row) => [Number(row?.question_section_id), row])
        .filter(([questionSectionId]) => Number.isFinite(questionSectionId) && questionSectionId > 0)
    );

    return {
      ...assessmentData,
      sections: assessmentData.sections.map((sectionWrapper) => ({
        ...sectionWrapper,
        section: {
          ...sectionWrapper.section,
          questions: (sectionWrapper.section?.questions || []).map((questionSection) => {
            const mergedRow = questionSectionById.get(Number(questionSection?.question_section_id));
            if (!mergedRow) return questionSection;

            return {
              ...questionSection,
              is_required:
                mergedRow?.is_required ??
                mergedRow?.question_section?.is_required ??
                questionSection?.is_required,
              include_sum_total:
                mergedRow?.include_sum_total ??
                mergedRow?.question_section?.include_sum_total ??
                questionSection?.include_sum_total,
              has_subquestion:
                mergedRow?.has_subquestion ??
                mergedRow?.question_section?.has_subquestion ??
                questionSection?.has_subquestion,
              sub_question_type:
                mergedRow?.sub_question_type ??
                mergedRow?.question_section?.sub_question_type ??
                questionSection?.sub_question_type,
              sub_question_prompt:
                mergedRow?.sub_question_prompt ??
                mergedRow?.question_section?.sub_question_prompt ??
                questionSection?.sub_question_prompt,
              unique_calculation:
                mergedRow?.unique_calculation ??
                mergedRow?.question_section?.unique_calculation ??
                questionSection?.unique_calculation,
              rule_id:
                mergedRow?.rule_id ??
                mergedRow?.question_section?.rule_id ??
                questionSection?.rule_id,
            };
          }),
        },
      })),
    };
  };

  const mergeAssessmentCalculationRulesIntoDetails = (assessmentData, assessmentRow) => {
    if (!assessmentData) return assessmentData;

    const calculationRules =
      assessmentRow?.calculation_rules ??
      assessmentRow?.assessment?.calculation_rules ??
      assessmentData?.calculation_rules ??
      assessmentData?.assessment?.calculation_rules;

    if (calculationRules === undefined) {
      return assessmentData;
    }

    return {
      ...assessmentData,
      calculation_rules: calculationRules,
      assessment: assessmentData?.assessment
        ? {
            ...assessmentData.assessment,
            calculation_rules: calculationRules,
          }
        : assessmentData.assessment,
    };
  };

  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      setLoading(true);

      const url =
        process.env.REACT_APP_API_URL_BASE +
        `/api/assessments-detail/${id}/`;
      const assessmentUrl =
        process.env.REACT_APP_API_URL_BASE +
        `/api/assessments/${id}/`;
      const questionSectionsUrl =
        process.env.REACT_APP_API_URL_BASE +
        `/api/question-sections/`;

      try {
        const [res, assessmentRes, questionSectionsRes] = await Promise.all([
          apiRequest(url),
          apiRequest(assessmentUrl),
          apiRequest(questionSectionsUrl),
        ]);
        const data = await res.json();
        const assessmentRow = assessmentRes.ok ? await assessmentRes.json() : null;
        const questionSectionData = questionSectionsRes.ok
          ? await questionSectionsRes.json()
          : [];

        setAssessmentDetails(
          mergeAssessmentCalculationRulesIntoDetails(
            mergeQuestionSectionFlagsIntoAssessmentDetails(
              data,
              Array.isArray(questionSectionData) ? questionSectionData : []
            ),
            assessmentRow
          )
        );
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

    const fetchCalculationRuleOptions = async () => {
      try {
        const res = await apiRequest(
          `${process.env.REACT_APP_API_URL_BASE}/api/calculation-rules/`
        );

        if (!res.ok) {
          setCalculationRuleOptions([]);
          return;
        }

        const data = await res.json();
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];

        setCalculationRuleOptions(rows);
      } catch (err) {
        console.error("Error fetching calculation rules:", err);
        setCalculationRuleOptions([]);
      }
    };

    fetchAssessmentDetails();
    fetchQuestionFlowRules();
    fetchConditionalSections();
    fetchCalculationRuleOptions();

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

  const calculationRuleFieldEntries = useMemo(() => {
    if (!calculationRuleDraft || typeof calculationRuleDraft !== "object") return [];

    const draftKeys = Object.keys(calculationRuleDraft);
    return draftKeys
      .slice()
      .sort((left, right) => {
        const leftIndex = calculationRuleFieldOrder.indexOf(left);
        const rightIndex = calculationRuleFieldOrder.indexOf(right);

        if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      })
      .map((fieldName) => ({
        fieldName,
        value: calculationRuleDraft[fieldName],
      }));
  }, [calculationRuleDraft]);

  const selectedCalculationRuleOption = useMemo(() => {
    const selectedType = String(calculationRuleDraft?.type ?? "").trim();
    if (!selectedType) return null;

    return (
      calculationRuleOptions.find(
        (option) => String(option?.calculation_key ?? "").trim() === selectedType
      ) || null
    );
  }, [calculationRuleDraft, calculationRuleOptions]);

  const calculationRuleQuestionOptions = useMemo(() => {
    const optionsByQuestionId = new Map();

    const appendQuestionSection = (questionSection) => {
      const questionId = Number(
        questionSection?.question?.question_id ??
        questionSection?.question_id ??
        questionSection?.question_section?.question_id ??
        0
      );
      const title = String(
        questionSection?.question?.title ??
        questionSection?.title ??
        questionSection?.question_section?.question?.title ??
        ""
      ).trim();

      if (!Number.isFinite(questionId) || questionId <= 0 || !title) return;
      if (optionsByQuestionId.has(questionId)) return;

      optionsByQuestionId.set(questionId, {
        value: questionId,
        label: title,
      });
    };

    (assessmentDetails?.sections || []).forEach((sectionWrapper) => {
      (sectionWrapper?.section?.questions || []).forEach(appendQuestionSection);
    });

    Object.values(conditionalSectionQuestions || {}).forEach((questionSections) => {
      (questionSections || []).forEach(appendQuestionSection);
    });

    return Array.from(optionsByQuestionId.values()).sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
    );
  }, [assessmentDetails, conditionalSectionQuestions]);

  const calculationRuleDescriptionLabels = useMemo(() => {
    const labels = ["Rule Type", "Question 1", "Question 2"];

    const selectedQuestion1Id = Number(calculationRuleDraft?.qid_1 ?? 0);
    const selectedQuestion2Id = Number(calculationRuleDraft?.qid_2 ?? 0);

    const selectedQuestion1 = calculationRuleQuestionOptions.find(
      (option) => option.value === selectedQuestion1Id
    );
    const selectedQuestion2 = calculationRuleQuestionOptions.find(
      (option) => option.value === selectedQuestion2Id
    );

    if (selectedQuestion1?.label) labels.push(selectedQuestion1.label);
    if (selectedQuestion2?.label) labels.push(selectedQuestion2.label);

    return labels;
  }, [calculationRuleDraft, calculationRuleQuestionOptions]);

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
    isRequired,
    includeSumTotal,
    uniqueCalculation,
    hasSubquestion,
    subQuestionType,
    subQuestionPrompt
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
      const isSignatureAgreement = isSignatureAgreementQuestionType(
        questionData?.question_type?.question_type_id,
        questionData?.question_type?.description
      );

      setEditingQuestion({
        question_id: questionData.question_id,
        question_section_id: questionSectionId,
        section_id: sectionId,
        question_order: normalizedQuestionOrder,
        is_required: normalizedIsRequired,
        include_sum_total: Boolean(includeSumTotal),
        unique_calculation: Boolean(uniqueCalculation),
        has_subquestion: Boolean(hasSubquestion),
        sub_question_type: (() => {
          const parsedSubQuestionType = Number(subQuestionType);
          return Number.isFinite(parsedSubQuestionType) && parsedSubQuestionType > 0
            ? parsedSubQuestionType
            : "";
        })(),
        sub_question_prompt: String(subQuestionPrompt ?? ""),
        title: questionData.title,
        question: questionData.question,
        hyperlink: questionData.hyperlink || "",
        is_active: questionData.is_active,
        question_type_id: questionData.question_type.question_type_id,
        use_default_options: questionData.use_default_options,

        choices: isSignatureAgreement
          ? questionData.choices ?? []
          : questionData.use_default_options
            ? (questionData.question_type.options || []).map((opt) => ({
                option: opt.option,
                report_verbiage: opt.report_verbiage ?? "",
                value: opt.value,
                order: opt.order,
              }))
            : (questionData.choices || []).map((c) => ({
                option: c.option,
                report_verbiage: c.report_verbiage ?? "",
                value: c.value,
                order: c.order,
              })),
        choices_json: isSignatureAgreement
          ? serializeQuestionChoicesJson(questionData.choices)
          : "",
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
    const resolvedIncludeSumTotal = Boolean(
      questionSectionData?.include_sum_total ?? newQuestion?.include_sum_total ?? false
    );
    const resolvedUniqueCalculation = Boolean(
      questionSectionData?.unique_calculation ?? newQuestion?.unique_calculation ?? false
    );
    const resolvedHasSubquestion = Boolean(
      questionSectionData?.has_subquestion ?? newQuestion?.has_subquestion ?? false
    );
    const resolvedSubQuestionType =
      questionSectionData?.sub_question_type ??
      newQuestion?.sub_question_type ??
      null;
    const resolvedSubQuestionPrompt =
      questionSectionData?.sub_question_prompt ??
      newQuestion?.sub_question_prompt ??
      "";

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
                    include_sum_total: resolvedIncludeSumTotal,
                    unique_calculation: resolvedUniqueCalculation,
                    has_subquestion: resolvedHasSubquestion,
                    sub_question_type: resolvedSubQuestionType,
                    sub_question_prompt: resolvedSubQuestionPrompt,
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

    const updateQuestionSectionFlagsInState = (
      questionSectionId,
      {
        isRequired,
        includeSumTotal,
        uniqueCalculation,
        hasSubquestion,
        subQuestionType,
        subQuestionPrompt,
      }
    ) => {
      const resolvedSubQuestionType = (() => {
        if (!hasSubquestion) return null;

        if (subQuestionType && typeof subQuestionType === "object") {
          return subQuestionType;
        }

        const parsedSubQuestionTypeId = Number(subQuestionType);
        if (!Number.isFinite(parsedSubQuestionTypeId) || parsedSubQuestionTypeId <= 0) {
          return null;
        }

        return (
          questionTypes.find(
            (questionType) =>
              Number(questionType?.question_type_id) === parsedSubQuestionTypeId
          ) || parsedSubQuestionTypeId
        );
      })();

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
                      question_section:
                        qs?.question_section && typeof qs.question_section === "object"
                          ? {
                              ...qs.question_section,
                              is_required: Boolean(isRequired),
                              include_sum_total: Boolean(includeSumTotal),
                              unique_calculation: Boolean(uniqueCalculation),
                              has_subquestion: Boolean(hasSubquestion),
                              sub_question_type: resolvedSubQuestionType,
                              sub_question_prompt: subQuestionPrompt ?? "",
                            }
                          : qs?.question_section,
                      is_required: Boolean(isRequired),
                      include_sum_total: Boolean(includeSumTotal),
                      unique_calculation: Boolean(uniqueCalculation),
                      has_subquestion: Boolean(hasSubquestion),
                      sub_question_type: resolvedSubQuestionType,
                      sub_question_prompt: subQuestionPrompt ?? "",
                    }
                  : qs
              ),
            },
          })),
        };
      });

      setConditionalSectionQuestions((prev) => {
        if (!prev) return prev;

        const nextEntries = Object.entries(prev).map(([sectionId, questions]) => {
          const nextQuestions = (questions || []).map((questionSection) =>
            questionSection.question_section_id === questionSectionId
              ? {
                  ...questionSection,
                  question_section:
                    questionSection?.question_section &&
                    typeof questionSection.question_section === "object"
                      ? {
                          ...questionSection.question_section,
                          is_required: Boolean(isRequired),
                          include_sum_total: Boolean(includeSumTotal),
                          unique_calculation: Boolean(uniqueCalculation),
                          has_subquestion: Boolean(hasSubquestion),
                          sub_question_type: resolvedSubQuestionType,
                          sub_question_prompt: subQuestionPrompt ?? "",
                        }
                      : questionSection?.question_section,
                  is_required: Boolean(isRequired),
                  include_sum_total: Boolean(includeSumTotal),
                  unique_calculation: Boolean(uniqueCalculation),
                  has_subquestion: Boolean(hasSubquestion),
                  sub_question_type: resolvedSubQuestionType,
                  sub_question_prompt: subQuestionPrompt ?? "",
                }
              : questionSection
          );

          return [sectionId, nextQuestions];
        });

        return Object.fromEntries(nextEntries);
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
      include_sum_total: Boolean(
        questionSectionData?.include_sum_total ?? newQuestion?.include_sum_total ?? false
      ),
      unique_calculation: Boolean(
        questionSectionData?.unique_calculation ?? newQuestion?.unique_calculation ?? false
      ),
      has_subquestion: Boolean(
        questionSectionData?.has_subquestion ?? newQuestion?.has_subquestion ?? false
      ),
      sub_question_type:
        questionSectionData?.sub_question_type ??
        newQuestion?.sub_question_type ??
        null,
      sub_question_prompt:
        questionSectionData?.sub_question_prompt ??
        newQuestion?.sub_question_prompt ??
        "",
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

const getQuestionSectionBoolean = (questionSection, fieldName) => {
  const rawValue =
    questionSection?.[fieldName] ??
    questionSection?.question_section?.[fieldName] ??
    false;

  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "number") return rawValue === 1;
  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return false;
};

const getQuestionSectionForeignKeyId = (questionSection, fieldName) => {
  const rawValue =
    questionSection?.[fieldName] ??
    questionSection?.question_section?.[fieldName] ??
    null;

  if (rawValue && typeof rawValue === "object") {
    const nestedId =
      rawValue?.question_type_id ??
      rawValue?.id ??
      rawValue?.value ??
      null;
    const parsedNestedId = Number(nestedId);
    return Number.isFinite(parsedNestedId) && parsedNestedId > 0
      ? parsedNestedId
      : null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getQuestionSectionRuleId = (questionSection) => {
  const rawValue =
    questionSection?.rule_id ??
    questionSection?.question_section?.rule_id ??
    null;

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
};

const getAssessmentCalculationRules = (assessment) => {
  const normalizeCalculationRulesValue = (value, depth = 0) => {
    if (depth > 3 || value === null || value === undefined) return [];

    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];

      try {
        return normalizeCalculationRulesValue(JSON.parse(trimmed), depth + 1);
      } catch {
        return [];
      }
    }

    if (typeof value === "object") {
      if (Array.isArray(value?.results)) {
        return normalizeCalculationRulesValue(value.results, depth + 1);
      }

      if (Object.prototype.hasOwnProperty.call(value, "calculation_rules")) {
        return normalizeCalculationRulesValue(value.calculation_rules, depth + 1);
      }

      if (Object.prototype.hasOwnProperty.call(value, "rule_id")) {
        return [value];
      }

      const objectValues = Object.values(value);
      const looksLikeRuleMap = objectValues.every(
        (entry) => entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "rule_id")
      );

      if (looksLikeRuleMap) {
        return objectValues;
      }
    }

    return [];
  };

  const candidates = [
    assessment?.calculation_rules,
    assessment?.assessment?.calculation_rules,
    assessment?.assessment_detail?.calculation_rules,
    assessment?.assessment_data?.calculation_rules,
    assessment,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCalculationRulesValue(candidate);
    if (normalized.length) {
      return normalized;
    }
  }

  return [];
};

const sanitizeCalculationRuleDraft = (draft) => {
  if (!draft || typeof draft !== "object") return null;

  return Object.entries(draft).reduce((accumulator, [fieldName, value]) => {
    if (fieldName === "type") {
      accumulator[fieldName] = String(value ?? "");
      return accumulator;
    }

    if (fieldName === "rule_id" || /^qid_\d+$/i.test(fieldName)) {
      const trimmed = String(value ?? "").trim();
      accumulator[fieldName] = trimmed === "" ? null : Number(trimmed);
      return accumulator;
    }

    accumulator[fieldName] = value;
    return accumulator;
  }, {});
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

  const closeCalculationRuleModal = () => {
    setIsCalculationRuleModalOpen(false);
    setCalculationRuleDraft(null);
    setActiveCalculationRuleQuestionTitle("");
  };

  const openCalculationRuleModal = (questionSection, questionTitle) => {
    const ruleId = getQuestionSectionRuleId(questionSection);
    if (ruleId === null) return;

    const normalizedCalculationRules = getAssessmentCalculationRules(assessmentDetails);
    const matchingRule = normalizedCalculationRules.find(
      (rule) => Number(rule?.rule_id) === ruleId
    );

    setCalculationRuleDraft(
      matchingRule && typeof matchingRule === "object"
        ? { ...matchingRule }
        : {
            rule_id: ruleId,
            type: "",
            qid_1: "",
            qid_2: "",
          }
    );
    setActiveCalculationRuleQuestionTitle(questionTitle || "");
    setIsCalculationRuleModalOpen(true);
  };

  const handleCalculationRuleFieldChange = (fieldName, value) => {
    setCalculationRuleDraft((prev) => ({
      ...(prev || {}),
      [fieldName]: fieldName === "rule_id" || /^qid_\d+$/i.test(fieldName)
        ? value
        : value,
    }));
  };

  const handleSaveCalculationRule = async () => {
    const sanitizedRule = sanitizeCalculationRuleDraft(calculationRuleDraft);
    const normalizedRuleId = Number(sanitizedRule?.rule_id);

    if (!Number.isFinite(normalizedRuleId)) return;

    setSavingCalculationRule(true);

    try {
      const existingRules = getAssessmentCalculationRules(assessmentDetails);
      const existingIndex = existingRules.findIndex(
        (rule) => Number(rule?.rule_id) === normalizedRuleId
      );
      const nextRules = existingIndex >= 0
        ? existingRules.map((rule, index) => (index === existingIndex ? sanitizedRule : rule))
        : [...existingRules, sanitizedRule];

      let response = await apiRequest(
        `${process.env.REACT_APP_API_URL_BASE}/api/assessments/${id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calculation_rules: nextRules }),
        }
      );

      if (!response.ok && response.status === 405) {
        response = await apiRequest(
          `${process.env.REACT_APP_API_URL_BASE}/api/assessments/${id}/`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: assessmentDetails?.name ?? "",
              description: assessmentDetails?.description ?? "",
              patient_instructions: assessmentDetails?.patient_instructions ?? "",
              patient_title: assessmentDetails?.patient_title ?? "",
              is_active: assessmentIsActive,
              calculation_rules: nextRules,
            }),
          }
        );
      }

      if (!response.ok) {
        throw new Error(`Update calculation rules failed with status ${response.status}`);
      }

      const updated = await response.json();
      const updatedRules = getAssessmentCalculationRules(updated).length
        ? getAssessmentCalculationRules(updated)
        : nextRules;

      setAssessmentDetails((prev) => ({
        ...prev,
        ...updated,
        calculation_rules: updatedRules,
        assessment: prev?.assessment
          ? {
              ...prev.assessment,
              ...(updated?.assessment || {}),
              calculation_rules: updatedRules,
            }
          : updated?.assessment,
      }));
      closeCalculationRuleModal();
    } catch (err) {
      console.error("Failed to save calculation rule", err);
    } finally {
      setSavingCalculationRule(false);
    }
  };

  const renderCalculatedValuePill = (questionSection, questionTitle) => {
    if (!getQuestionSectionBoolean(questionSection, "unique_calculation")) {
      return null;
    }

    const ruleId = getQuestionSectionRuleId(questionSection);

    return (
      <button
        type="button"
        style={{
          ...calculatedValuePillStyle,
          border: "none",
          cursor: ruleId === null ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
        title={
          ruleId === null
            ? "This question section does not have a rule_id yet."
            : `Edit calculation rule ${ruleId}`
        }
        onClick={() => openCalculationRuleModal(questionSection, questionTitle)}
        disabled={ruleId === null}
      >
        Calculated Value
      </button>
    );
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

  const handleDownloadExampleReportPdf = async () => {
    const reportElement = exampleReportRef.current;
    if (!reportElement || isDownloadingExampleReport) return;

    setIsDownloadingExampleReport(true);

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#0b1220",
        logging: false,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight,
      });

      const basePdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = basePdf.internal.pageSize.getWidth();
      const renderedHeightMm = (canvas.height / canvas.width) * pageWidth;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageWidth, renderedHeightMm] });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      pdf.setFillColor(11, 18, 32);
      pdf.rect(0, 0, pageWidth, renderedHeightMm, "F");
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, renderedHeightMm);

      const assessmentName =
        String(assessmentDetails?.name || "CognitrackX_Example_Report")
          .trim()
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9_-]/g, "") || "CognitrackX_Example_Report";
      const dateStamp = new Date().toISOString().slice(0, 10);

      pdf.save(`${assessmentName}_${dateStamp}.pdf`);
    } catch (error) {
      console.error("Failed to download example report PDF", error);
    } finally {
      setIsDownloadingExampleReport(false);
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

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
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
          <button
            onClick={() => setIsExampleReportOpen(true)}
            style={{
              padding: "8px 16px",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 400,
            }}
          >
            Example Report
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
                          {getQuestionSectionBoolean(qs, "include_sum_total") && (
                            <span style={addToTotalPillStyle}>Add to Total</span>
                          )}
                          {getQuestionSectionBoolean(qs, "has_subquestion") && (
                            <span style={addToTotalPillStyle}>Has Subquestion</span>
                          )}
                          {renderCalculatedValuePill(qs, qs.question.title)}
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
                                qs?.is_required ?? qs?.question_section?.is_required ?? false,
                                getQuestionSectionBoolean(qs, "include_sum_total"),
                                getQuestionSectionBoolean(qs, "unique_calculation"),
                                getQuestionSectionBoolean(qs, "has_subquestion"),
                                getQuestionSectionForeignKeyId(qs, "sub_question_type"),
                                qs?.sub_question_prompt ?? qs?.question_section?.sub_question_prompt ?? ""
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
                                  {getQuestionSectionBoolean(flowQuestionForRow, "include_sum_total") && (
                                    <span style={addToTotalPillStyle}>Add to Total</span>
                                  )}
                                  {getQuestionSectionBoolean(flowQuestionForRow, "has_subquestion") && (
                                    <span style={addToTotalPillStyle}>Has Subquestion</span>
                                  )}
                                  {renderCalculatedValuePill(
                                    flowQuestionForRow,
                                    flowQuestionForRow?.question?.title || "Question Title"
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
                                      flowQuestionForRow?.is_required ?? flowQuestionForRow?.question_section?.is_required ?? false,
                                      getQuestionSectionBoolean(flowQuestionForRow, "include_sum_total"),
                                      getQuestionSectionBoolean(flowQuestionForRow, "unique_calculation"),
                                      getQuestionSectionBoolean(flowQuestionForRow, "has_subquestion"),
                                        getQuestionSectionForeignKeyId(flowQuestionForRow, "sub_question_type"),
                                        flowQuestionForRow?.sub_question_prompt ?? flowQuestionForRow?.question_section?.sub_question_prompt ?? ""
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
                                  include_sum_total: false,
                                  unique_calculation: false,
                                  has_subquestion: false,
                                  sub_question_type: "",
                                  sub_question_prompt: "",
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
                                {getQuestionSectionBoolean(flowQ, "include_sum_total") && (
                                  <span style={addToTotalPillStyle}>Add to Total</span>
                                )}
                                {getQuestionSectionBoolean(flowQ, "has_subquestion") && (
                                  <span style={addToTotalPillStyle}>Has Subquestion</span>
                                )}
                                {renderCalculatedValuePill(
                                  flowQ,
                                  flowQ?.question?.title || "Question Title"
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
                                    flowQ?.is_required ?? flowQ?.question_section?.is_required ?? false,
                                    getQuestionSectionBoolean(flowQ, "include_sum_total"),
                                    getQuestionSectionBoolean(flowQ, "unique_calculation"),
                                    getQuestionSectionBoolean(flowQ, "has_subquestion"),
                                    getQuestionSectionForeignKeyId(flowQ, "sub_question_type"),
                                    flowQ?.sub_question_prompt ?? flowQ?.question_section?.sub_question_prompt ?? ""
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
                                    include_sum_total: false,
                                    unique_calculation: false,
                                    has_subquestion: false,
                                    sub_question_type: "",
                                    sub_question_prompt: "",
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
                        include_sum_total: false,
                        unique_calculation: false,
                        has_subquestion: false,
                        sub_question_type: "",
                        sub_question_prompt: "",
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

        {isCalculationRuleModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.42)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "24px 16px",
              zIndex: 1360,
            }}
          >
            <div
              style={{
                background: "#fff",
                width: "560px",
                maxWidth: "calc(100vw - 32px)",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
              }}
            >
              <div
                style={{
                  padding: "20px 24px 18px",
                  background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: "#0f172a" }}>Edit Calculated Value Rule</h3>
                    <p style={{ margin: "6px 0 0", color: "#475569", fontSize: "0.95rem" }}>
                      Update the calculation logic tied to this question.
                    </p>
                  </div>
                  {calculationRuleDraft?.rule_id !== undefined && calculationRuleDraft?.rule_id !== null && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      rule_id: {calculationRuleDraft.rule_id}
                    </span>
                  )}
                </div>
                {activeCalculationRuleQuestionTitle && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.9)",
                      border: "1px solid #dbeafe",
                      color: "#334155",
                      fontWeight: 500,
                    }}
                  >
                    {activeCalculationRuleQuestionTitle}
                  </div>
                )}
              </div>

              <div style={{ padding: "22px 24px 24px" }}>
                {calculationRuleFieldEntries.map(({ fieldName, value }) => {
                  if (fieldName === "rule_id") {
                    return null;
                  }

                  const isNumericField = /^qid_\d+$/i.test(fieldName);
                  const isRuleTypeField = fieldName === "type";
                  const isQuestionReferenceField = fieldName === "qid_1" || fieldName === "qid_2";
                  const label = isRuleTypeField
                    ? "Rule Type"
                    : fieldName === "qid_1"
                      ? "Question 1"
                      : fieldName === "qid_2"
                        ? "Question 2"
                        : fieldName;

                  return (
                    <React.Fragment key={fieldName}>
                      <div style={{ marginBottom: isRuleTypeField ? "14px" : "16px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "6px",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            color: "#334155",
                          }}
                        >
                          {label}
                        </label>
                        {isRuleTypeField ? (
                          <select
                            value={value ?? ""}
                            onChange={(e) => handleCalculationRuleFieldChange(fieldName, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "11px 12px",
                              borderRadius: "10px",
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: "0.95rem",
                            }}
                          >
                            <option value="">Select a rule type</option>
                            {calculationRuleOptions.map((option, index) => {
                              const calculationKey = String(option?.calculation_key ?? "").trim();
                              if (!calculationKey) return null;

                              return (
                                <option
                                  key={`${calculationKey}-${index}`}
                                  value={calculationKey}
                                >
                                  {calculationKey}
                                </option>
                              );
                            })}
                          </select>
                        ) : isQuestionReferenceField ? (
                          <select
                            value={value ?? ""}
                            onChange={(e) => handleCalculationRuleFieldChange(fieldName, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "11px 12px",
                              borderRadius: "10px",
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: "0.95rem",
                            }}
                          >
                            <option value="">Select a question</option>
                            {calculationRuleQuestionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={isNumericField ? "number" : "text"}
                            value={value ?? ""}
                            onChange={(e) => handleCalculationRuleFieldChange(fieldName, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "11px 12px",
                              borderRadius: "10px",
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: "0.95rem",
                            }}
                          />
                        )}
                      </div>

                      {isRuleTypeField && (
                        <div style={{ marginBottom: "16px" }}>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "6px",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: "#334155",
                            }}
                          >
                            Description
                          </label>
                          <div
                            style={{
                              width: "100%",
                              padding: "11px 12px",
                              borderRadius: "10px",
                              border: "1px solid #dbeafe",
                              background: "#f8fafc",
                              color: "#475569",
                              lineHeight: 1.55,
                              minHeight: "88px",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {renderHighlightedDescriptionText(
                              selectedCalculationRuleOption?.description ?? "",
                              calculationRuleDescriptionLabels
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "8px",
                    paddingTop: "18px",
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <button
                    onClick={closeCalculationRuleModal}
                    disabled={savingCalculationRule}
                    style={{
                      background: "#fff",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      padding: "9px 14px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    style={{
                      background: "#007bff",
                      color: "#fff",
                      border: "none",
                      padding: "9px 16px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: 700,
                      boxShadow: "0 10px 20px rgba(0, 123, 255, 0.18)",
                    }}
                    onClick={handleSaveCalculationRule}
                    disabled={savingCalculationRule}
                  >
                    {savingCalculationRule ? "Saving..." : "Save"}
                  </button>
                </div>
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
                const normalizedSelectedType = normalizeQuestionTypeDescription(
                  selectedType?.description
                );
                const isPerformTaskVideo = normalizedSelectedType === "perform_task_video";
                const isSignatureAgreement = isSignatureAgreementQuestionType(
                  editingQuestion.question_type_id,
                  selectedType?.description
                );
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
                let serializedSignatureAgreementChoices = editingQuestion.choices;

                if (isSignatureAgreement) {
                  const rawChoicesJson = String(editingQuestion.choices_json ?? "").trim();

                  if (!rawChoicesJson) {
                    serializedSignatureAgreementChoices = [];
                  } else {
                    try {
                      serializedSignatureAgreementChoices = JSON.parse(rawChoicesJson);
                    } catch {
                      window.alert("Signature agreement choices must be valid JSON.");
                      return;
                    }
                  }
                }

                const payload = {
                  title: editingQuestion.title,
                  question: editingQuestion.question,
                  is_active: editingQuestion.is_active,
                  question_type_id: editingQuestion.question_type_id,
                  use_default_options: editingQuestion.use_default_options,
                  choices: editingQuestion.use_default_options
                    ? []
                    : isSignatureAgreement
                      ? serializedSignatureAgreementChoices
                      : editingQuestion.choices,
                  ...(isPerformTaskVideo || isSignatureAgreement
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
                        include_sum_total: Boolean(editingQuestion.include_sum_total),
                        unique_calculation: Boolean(editingQuestion.unique_calculation),
                        has_subquestion: Boolean(editingQuestion.has_subquestion),
                        sub_question_type:
                          Boolean(editingQuestion.has_subquestion) &&
                          Number.isFinite(Number(editingQuestion.sub_question_type)) &&
                          Number(editingQuestion.sub_question_type) > 0
                            ? Number(editingQuestion.sub_question_type)
                            : null,
                        sub_question_prompt: Boolean(editingQuestion.has_subquestion)
                          ? String(editingQuestion.sub_question_prompt ?? "")
                          : "",
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
                          include_sum_total: Boolean(editingQuestion.include_sum_total),
                          unique_calculation: Boolean(editingQuestion.unique_calculation),
                          has_subquestion: Boolean(editingQuestion.has_subquestion),
                          sub_question_type:
                            Boolean(editingQuestion.has_subquestion) &&
                            Number.isFinite(Number(editingQuestion.sub_question_type)) &&
                            Number(editingQuestion.sub_question_type) > 0
                              ? Number(editingQuestion.sub_question_type)
                              : null,
                          sub_question_prompt: Boolean(editingQuestion.has_subquestion)
                            ? String(editingQuestion.sub_question_prompt ?? "")
                            : "",
                        }),
                      }
                    );

                    updateQuestionSectionOrderInState(
                      editingQuestion.question_section_id,
                      normalizedQuestionOrder
                    );

                    updateQuestionSectionFlagsInState(
                      editingQuestion.question_section_id,
                      {
                        isRequired: editingQuestion.is_required,
                        includeSumTotal: editingQuestion.include_sum_total,
                        uniqueCalculation: editingQuestion.unique_calculation,
                        hasSubquestion: editingQuestion.has_subquestion,
                        subQuestionType:
                          Boolean(editingQuestion.has_subquestion) &&
                          Number.isFinite(Number(editingQuestion.sub_question_type)) &&
                          Number(editingQuestion.sub_question_type) > 0
                            ? Number(editingQuestion.sub_question_type)
                            : null,
                        subQuestionPrompt: Boolean(editingQuestion.has_subquestion)
                          ? String(editingQuestion.sub_question_prompt ?? "")
                          : "",
                      }
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
                                  include_sum_total: Boolean(editingQuestion.include_sum_total),
                                  unique_calculation: Boolean(editingQuestion.unique_calculation),
                                  has_subquestion: Boolean(editingQuestion.has_subquestion),
                                  sub_question_type:
                                    Boolean(editingQuestion.has_subquestion) &&
                                    Number.isFinite(Number(editingQuestion.sub_question_type)) &&
                                    Number(editingQuestion.sub_question_type) > 0
                                      ? Number(editingQuestion.sub_question_type)
                                      : null,
                                  sub_question_prompt: Boolean(editingQuestion.has_subquestion)
                                    ? String(editingQuestion.sub_question_prompt ?? "")
                                    : "",
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

        {isExampleReportOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.56)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "20px",
              zIndex: 1400,
            }}
          >
            <div
              style={{
                width: "min(1280px, 100%)",
                height: "min(92vh, 980px)",
                background: "#ffffff",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 30px 80px rgba(15, 23, 42, 0.32)",
                border: "1px solid rgba(219, 234, 254, 0.8)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>Example Report</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "2px" }}>
                    Previewing the CognitrackX redacted PDF example
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    onClick={handleDownloadExampleReportPdf}
                    disabled={isDownloadingExampleReport}
                    style={{
                      background: isDownloadingExampleReport ? "#cbd5e1" : "#0f172a",
                      color: isDownloadingExampleReport ? "#475569" : "#ffffff",
                      border: "1px solid #0f172a",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      cursor: isDownloadingExampleReport ? "not-allowed" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {isDownloadingExampleReport ? "Generating PDF..." : "Download PDF"}
                  </button>
                  <button
                    onClick={() => setIsExampleReportOpen(false)}
                    style={{
                      background: "#fff",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <div ref={exampleReportRef}>
                  <CognitrackXReportExample />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default AssessmentDetails;
