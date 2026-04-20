import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./RunAssessment.css";
import { getSelectedCompany } from "../auth";
import { apiRequest } from "../api";

const PERF_DEBUG = process.env.REACT_APP_PERF_DEBUG === "1";

const DEFAULT_BRAND_LOGO_URL =
  "https://valhallaplus.org/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fvalhalla-icon.c13cd40e.png&w=64&q=75";
const API_BASE = process.env.REACT_APP_API_URL_BASE;
const PATIENT_ASSESSMENT_ATTEMPTS_API = `${API_BASE}/api/patient-assessment-attempts/`;
const PATIENT_RESPONSES_API = `${API_BASE}/api/patient-responses/`;
const PATIENT_RESPONSES_HISTORY_API = `${API_BASE}/api/patient-responses-history/`;

const normalizePrefillPrompt = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!:]+$/g, "")
    .trim();

  return normalized;
};

const parseDateOnlyYmd = (raw) => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const ymdMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return {
      year,
      month,
      day,
      ymd: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = parsed.getMonth() + 1;
    const day = parsed.getDate();
    return {
      year,
      month,
      day,
      ymd: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  } catch {
    return null;
  }
};

const calculateAgeFromDob = (dobParts) => {
  if (!dobParts) return null;

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const nowDay = now.getDate();

  let age = nowYear - dobParts.year;
  if (nowMonth < dobParts.month || (nowMonth === dobParts.month && nowDay < dobParts.day)) {
    age -= 1;
  }

  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  return age;
};

const normalizeQuestionType = (question) =>
  String(question?.question_type?.description ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const getScaleResponseConfig = (questionType) => {
  const normalizedType = String(questionType ?? "").trim().toLowerCase();
  const match = normalizedType.match(/^scale_response_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const parsedMin = Number(match[1]);
  const parsedMax = Number(match[2]);

  if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) return null;

  const min = Math.min(parsedMin, parsedMax);
  const max = Math.max(parsedMin, parsedMax);
  const isIntegerScale = Number.isInteger(min) && Number.isInteger(max);
  const midpoint = (min + max) / 2;
  const defaultValue = isIntegerScale
    ? Math.round(midpoint)
    : Number(midpoint.toFixed(2));

  return {
    min,
    max,
    step: isIntegerScale ? 1 : 0.1,
    defaultValue,
  };
};

const getQuestionOrder = (questionSection) => {
  const rawOrder =
    questionSection?.order ??
    questionSection?.question_order ??
    questionSection?.question_section_order ??
    questionSection?.question_section?.order ??
    questionSection?.question_section?.question_order ??
    null;

  const parsed = Number(rawOrder);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toBooleanRequired = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return false;
};

const hasResponseValue = (value) => {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    const objectValues = Object.values(value);
    if (objectValues.length === 0) return false;
    return objectValues.some((item) => hasResponseValue(item));
  }

  return true;
};

const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getScoreValueFromAnswer = (answerValue) => {
  if (!answerValue) return 0;

  if (Array.isArray(answerValue)) {
    return answerValue.reduce((total, item) => {
      if (!item) return total;
      const parsed = toFiniteNumberOrNull(item?.value);
      return total + (parsed ?? 0);
    }, 0);
  }

  if (typeof answerValue === "object") {
    const parsed = toFiniteNumberOrNull(answerValue?.value);
    return parsed ?? 0;
  }

  return 0;
};

const getSelectedOptionOrder = (responseValue) => {
  if (responseValue === null || responseValue === undefined) return NaN;

  if (typeof responseValue === "object" && !Array.isArray(responseValue)) {
    const order = Number(responseValue?.order);
    return Number.isFinite(order) ? order : NaN;
  }

  if (typeof responseValue === "number") {
    return Number.isFinite(responseValue) ? responseValue : NaN;
  }

  if (typeof responseValue === "string") {
    const trimmed = responseValue.trim();
    if (!trimmed) return NaN;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  return NaN;
};

const getFlatQuestions = (sections) => {
  const sortedSections = [...(sections ?? [])].sort(
    (left, right) => Number(left.sectionOrder ?? 0) - Number(right.sectionOrder ?? 0)
  );

  return sortedSections.flatMap((section) => {
    const sortedQuestions = [...(section.questions ?? [])].sort((left, right) => {
      const leftOrder = getQuestionOrder(left);
      const rightOrder = getQuestionOrder(right);

      if (leftOrder === null && rightOrder === null) return 0;
      if (leftOrder === null) return 1;
      if (rightOrder === null) return -1;
      return leftOrder - rightOrder;
    });

    return sortedQuestions.map((questionSection, index) => ({
      assessmentSectionId: Number(section.assessment_section_id ?? section.assessmentSectionId ?? 0) || null,
      sectionId: section.section_id,
      sectionTitle: section.title,
      sectionOrder: Number(section.sectionOrder ?? 0),
      questionOrder: getQuestionOrder(questionSection),
      isRequired: toBooleanRequired(
        questionSection?.is_required ??
        questionSection?.question_section?.is_required ??
        false
      ),
      questionSectionId: Number(
        questionSection?.question_section_id ??
        questionSection?.question_section?.question_section_id ??
        0
      ),
      questionSection,
      question: questionSection?.question ?? {},
    }));
  });
};

let youTubeApiLoader = null;

const loadYouTubeIframeApi = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is unavailable outside browser context."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youTubeApiLoader) {
    return youTubeApiLoader;
  }

  youTubeApiLoader = new Promise((resolve) => {
    const existingScript = document.querySelector("script[src='https://www.youtube.com/iframe_api']");

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") {
        previousReady();
      }
      resolve(window.YT);
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youTubeApiLoader;
};

const hasPopulatedOptions = (options) => {
  if (!options) return false;
  if (Array.isArray(options)) return options.length > 0;
  if (typeof options === "object") return Object.keys(options).length > 0;
  return false;
};

const normalizeOptions = (question) => {
  const questionTypeOptions = question?.question_type?.options;
  const questionChoices = question?.choices;

  const options = hasPopulatedOptions(questionTypeOptions)
    ? questionTypeOptions
    : hasPopulatedOptions(questionChoices)
      ? questionChoices
      : null;

  if (!options) return [];

  if (Array.isArray(options)) {
    return options
      .map((optionItem, index) => {
        if (optionItem && typeof optionItem === "object") {
          return {
            order: Number(optionItem?.order ?? index + 1),
            option: String(optionItem?.option ?? optionItem?.label ?? ""),
            value: optionItem?.value ?? optionItem?.option ?? optionItem?.label ?? "",
          };
        }

        return {
          order: index + 1,
          option: String(optionItem ?? ""),
          value: optionItem ?? "",
        };
      })
      .filter((optionItem) => optionItem.option);
  }

  if (typeof options === "object") {
    const hasStructuredValues = Object.values(options).every(
      (value) => value && typeof value === "object" && ("option" in value || "label" in value)
    );

    if (hasStructuredValues) {
      return Object.values(options)
        .map((value, index) => ({
          order: Number(value?.order ?? index + 1),
          option: String(value?.option ?? value?.label ?? ""),
          value: value?.value ?? value?.option ?? value?.label ?? "",
        }))
        .filter((optionItem) => optionItem.option);
    }

    return Object.entries(options).map(([option, value], index) => ({
      order: index + 1,
      option,
      value,
    }));
  }

  return [];
};

const formatPhoneInput = (rawValue) => {
  const digits = String(rawValue ?? "").replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const normalizeVideoUrl = (rawUrl) => {
  const value = String(rawUrl ?? "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return `https:${value}`;
  if (/^(www\.|youtu\.be\/|youtube\.com\/|vimeo\.com\/)/i.test(value)) {
    return `https://${value}`;
  }

  return value;
};

const isDirectVideoFileUrl = (urlValue) => {
  if (!urlValue) return false;
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(urlValue);
};

const toEmbeddableVideoUrl = (rawUrl) => {
  const value = normalizeVideoUrl(rawUrl);
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const videoId = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      if (!videoId) return value;
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const watchId = parsed.searchParams.get("v");
      const shortsId = pathParts[0] === "shorts" ? pathParts[1] : null;
      const liveId = pathParts[0] === "live" ? pathParts[1] : null;
      const legacyId = pathParts[0] === "v" ? pathParts[1] : null;
      const embedId = pathParts[0] === "embed" ? pathParts[1] : null;
      const videoId = watchId || shortsId || liveId || legacyId || embedId;

      if (!videoId) return "";

      const rawStart = parsed.searchParams.get("t") || parsed.searchParams.get("start");
      const startSeconds = Number.parseInt(String(rawStart ?? "").replace(/\D/g, ""), 10);
      const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        autoplay: "0",
        enablejsapi: "1",
      });

      if (typeof window !== "undefined" && window.location?.origin) {
        params.set("origin", window.location.origin);
      }

      if (Number.isFinite(startSeconds) && startSeconds > 0) {
        params.set("start", String(startSeconds));
      }

      return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    }

    if (host.includes("vimeo.com")) {
      const videoId = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      if (!videoId) return "";
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return "";
  } catch {
    return "";
  }
};

const SignatureDrawField = ({ value, onChange }) => {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const normalizedValue = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  const signatureDataUrl = String(normalizedValue.signature_data_url ?? "");
  const fullName = String(normalizedValue.full_name ?? "");

  const applyCanvasScale = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(280, Math.floor(wrapper.clientWidth));
    const height = 210;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";
    context.lineWidth = 2.2;

    if (signatureDataUrl) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, width, height);
      };
      image.src = signatureDataUrl;
      hasInkRef.current = true;
    } else {
      hasInkRef.current = false;
    }
  }, [signatureDataUrl]);

  useEffect(() => {
    applyCanvasScale();
  }, [applyCanvasScale]);

  useEffect(() => {
    const onResize = () => applyCanvasScale();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [applyCanvasScale]);

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const emitSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    onChange({
      signature_data_url: hasInkRef.current ? canvas.toDataURL("image/png") : "",
      full_name: fullName,
    });
  };

  const startDraw = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    isDrawingRef.current = true;
    activePointerIdRef.current = event.pointerId;
    lastPointRef.current = point;
    canvas.setPointerCapture?.(event.pointerId);

    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawMove = (event) => {
    if (!isDrawingRef.current) return;
    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    hasInkRef.current = true;
  };

  const endDraw = (event) => {
    if (!isDrawingRef.current) return;
    if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
      return;
    }

    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    emitSignature();
  };

  const clearSignature = () => {
    hasInkRef.current = false;
    onChange({
      signature_data_url: "",
      full_name: fullName,
    });
  };

  return (
    <div className="run-assessment-signature-wrap">
      <div className="run-assessment-signature-label">Sign Here</div>
      <div className="run-assessment-signature-canvas-wrap" ref={wrapperRef}>
        <canvas
          ref={canvasRef}
          className="run-assessment-signature-canvas"
          onPointerDown={startDraw}
          onPointerMove={drawMove}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
        />
      </div>

      <div className="run-assessment-signature-actions">
        <button
          type="button"
          className="run-assessment-signature-clear-btn"
          onClick={clearSignature}
        >
          Clear Signature
        </button>
      </div>

      <label className="run-assessment-signature-name-label" htmlFor="signature-full-name-input">
        Type Your Full Name Here:
      </label>
      <input
        id="signature-full-name-input"
        type="text"
        value={fullName}
        onChange={(event) =>
          onChange({
            signature_data_url: signatureDataUrl,
            full_name: event.target.value,
          })
        }
        className="run-assessment-input"
      />
    </div>
  );
};

const getInitialResponse = (questionType) => {
  const scaleConfig = getScaleResponseConfig(questionType);
  if (scaleConfig) {
    return scaleConfig.defaultValue;
  }

  if (questionType === "multi_select" || questionType === "multiple_select") {
    return [];
  }
  if (questionType === "first_last_name_response") {
    return { first_name: "", last_name: "" };
  }
  if (questionType === "first_middle_last_name_response") {
    return { first_name: "", middle_name: "", last_name: "" };
  }
  if (questionType === "signature_draw") {
    return { signature_data_url: "", full_name: "" };
  }
  return "";
};

const getVideoSource = (rawUrl) => {
  const normalizedUrl = normalizeVideoUrl(rawUrl);
  if (!normalizedUrl) {
    return { kind: "none", url: "" };
  }

  if (isDirectVideoFileUrl(normalizedUrl)) {
    return { kind: "native", url: normalizedUrl };
  }

  const embedUrl = toEmbeddableVideoUrl(normalizedUrl);
  if (embedUrl) {
    return { kind: "embed", url: embedUrl };
  }

  return { kind: "external", url: normalizedUrl };
};

const getYouTubeEmbedVideoId = (embedUrl) => {
  const match = String(embedUrl ?? "").match(
    /youtube(?:-nocookie)?\.com\/embed\/([^?&#/]+)/i
  );
  return match?.[1] ?? "";
};

const normalizeApiRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getAttemptIdValue = (attempt) =>
  Number(
    attempt?.id ??
    attempt?.assessment_attempt_id ??
    attempt?.patient_assessment_attempt_id ??
    attempt?.attempt_id ??
    0
  ) || 0;

const getAttemptPatientIdValue = (attempt) =>
  Number(attempt?.patient?.patient_id ?? attempt?.patient_id ?? 0) || 0;

const getAttemptAssessmentIdValue = (attempt) =>
  Number(attempt?.assessment?.assessment_id ?? attempt?.assessment_id ?? 0) || 0;

const getAttemptQuestionIdValue = (attempt) =>
  Number(attempt?.current_question?.question_id ?? attempt?.current_question_id ?? 0) || 0;

const getAttemptSectionIdValue = (attempt) =>
  Number(
    attempt?.current_section?.assessment_section_id ??
    attempt?.current_section?.id ??
    attempt?.current_section_id ??
    0
  ) || 0;

const getResponseRecordId = (responseItem) =>
  Number(responseItem?.id ?? responseItem?.patient_response_id ?? 0) || 0;

const getResponseQuestionId = (responseItem) =>
  Number(
    responseItem?.question?.question_id ??
    responseItem?.question_id ??
    responseItem?.question ??
    0
  ) || 0;

const getResponseAttemptId = (responseItem) =>
  Number(
    responseItem?.attempt?.id ??
      responseItem?.attempt_id ??
      responseItem?.assessment_attempt_id ??
      responseItem?.patient_assessment_attempt_id ??
      responseItem?.patient_assessment_attempt ??
      responseItem?.attempt ??
      0
  ) || 0;

const normalizeStoredAnswerValue = (value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!looksJson) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const getRulePriorityValue = (rule) => {
  const parsed = Number(rule?.priority);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const getSourceQuestionIdFromRule = (rule) =>
  Number(rule?.source_question?.question_id ?? rule?.source_question_id ?? 0) || 0;

const getTargetSectionIdFromRule = (rule) =>
  Number(rule?.target_section?.section_id ?? rule?.target_section_id ?? 0) || 0;

const getRuleMatchValues = (rule) => {
  const raw = rule?.match_value;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return [raw];
  return [];
};

const normalizeComparableValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value).trim();
  if (!text) return null;

  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;

  return text;
};

const collectResponseComparableValues = (responseValue) => {
  if (responseValue === null || responseValue === undefined) return [];

  if (Array.isArray(responseValue)) {
    const values = responseValue.flatMap((item) => collectResponseComparableValues(item));
    return Array.from(new Set(values.map((v) => String(v)))).map((v) => {
      const num = Number(v);
      return Number.isFinite(num) && String(num) === v ? num : v;
    });
  }

  if (typeof responseValue === "object") {
    const values = [];
    const valueCandidate = normalizeComparableValue(responseValue?.value);
    if (valueCandidate !== null) values.push(valueCandidate);

    const orderCandidate = normalizeComparableValue(responseValue?.order);
    if (orderCandidate !== null) values.push(orderCandidate);

    return values;
  }

  const normalized = normalizeComparableValue(responseValue);
  return normalized === null ? [] : [normalized];
};

const doesRuleMatchResponseValue = (rule, responseValue) => {
  const responseValues = collectResponseComparableValues(responseValue);
  if (!responseValues.length) return false;

  const ruleValues = getRuleMatchValues(rule)
    .map((entry) => normalizeComparableValue(entry?.value))
    .filter((entry) => entry !== null);

  if (!ruleValues.length) return false;

  return ruleValues.some((ruleValue) =>
    responseValues.some((responseCandidate) => responseCandidate === ruleValue)
  );
};

export default function RunAssessment({
  isOpen,
  onClose,
  onSubmitComplete,
  assessmentName,
  sections,
  shouldPersistAssessmentResponses = true,
  startQuestionSectionId = null,
  startQuestionId = null,
  forceConditionalSourceQuestionId = null,
  forceConditionalTargetSectionId = null,
  patientId = null,
  assessmentId = null,
  patientEventId = null,
  attemptIdOverride = null,
  prefillData = null,
  showMetadataToggle = true,
  requestFn = apiRequest,
}) {
  const questions = useMemo(() => getFlatQuestions(sections), [sections]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [showMetadata, setShowMetadata] = useState(false);
  const [shellEnterClass, setShellEnterClass] = useState("");
  const [isAnimatingShell, setIsAnimatingShell] = useState(false);
  const [videoCompletionByQuestionId, setVideoCompletionByQuestionId] = useState({});
  const [youtubeEmbedFallbackByQuestionId, setYoutubeEmbedFallbackByQuestionId] = useState({});
  const shellRef = useRef(null);
  const youtubeContainerRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeMountNodeRef = useRef(null);
  const shellAnimationDurationMs = 319;
  const selectedCompany = getSelectedCompany();
  const [attemptId, setAttemptId] = useState(null);
  const [isAttemptReady, setIsAttemptReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flowRules, setFlowRules] = useState([]);
  const [conditionalQuestionSectionsBySectionId, setConditionalQuestionSectionsBySectionId] = useState({});
  const [isConditionalFlowDataLoading, setIsConditionalFlowDataLoading] = useState(false);
  const [isResolvingRequestedStart, setIsResolvingRequestedStart] = useState(false);
  const responseIdByQuestionIdRef = useRef({});
  const appliedStartRequestRef = useRef(null);
  const numericPatientId = Number(patientId);
  const numericAssessmentId = Number(assessmentId);
  const numericPatientEventId = Number(patientEventId);
  const numericAttemptIdOverride = Number(attemptIdOverride);
  const hasValidAttemptOverride =
    Number.isFinite(numericAttemptIdOverride) && numericAttemptIdOverride > 0;
  const hasAttemptContext =
    hasValidAttemptOverride || (
      Number.isFinite(numericPatientId) && numericPatientId > 0 &&
      Number.isFinite(numericAssessmentId) && numericAssessmentId > 0
    );
  const canPersistAttempts = shouldPersistAssessmentResponses && hasAttemptContext;

  const getQuestionIdForItem = (item) =>
    Number(item?.question?.question_id ?? item?.questionSection?.question_id ?? 0) || 0;

  const getSectionIdForItem = (item) =>
    Number(item?.assessmentSectionId ?? item?.sectionId ?? 0) || 0;

  useEffect(() => {
    if (!isOpen) {
      setFlowRules([]);
      setConditionalQuestionSectionsBySectionId({});
      setIsConditionalFlowDataLoading(false);
      return;
    }

    const resolvedAssessmentId = Number(assessmentId);
    if (!Number.isFinite(resolvedAssessmentId) || resolvedAssessmentId <= 0) {
      setFlowRules([]);
      setConditionalQuestionSectionsBySectionId({});
      return;
    }

    let cancelled = false;

    const loadConditionalFlowData = async () => {
      if (!cancelled) {
        setIsConditionalFlowDataLoading(true);
      }

      try {
        const forcedTargetSectionId = Number(forceConditionalTargetSectionId);
        const hasForcedTargetSectionId =
          Number.isFinite(forcedTargetSectionId) && forcedTargetSectionId > 0;

        const rulesRes = await requestFn(
          `${API_BASE}/api/question-flow-rules/?assessment=${resolvedAssessmentId}`
        );

        if (!rulesRes.ok) {
          if (!cancelled) {
            setFlowRules([]);
            setConditionalQuestionSectionsBySectionId({});
            setIsConditionalFlowDataLoading(false);
          }
          return;
        }

        const rulesPayload = await rulesRes.json();
        const activeRules = (Array.isArray(rulesPayload) ? rulesPayload : []).filter(
          (rule) => rule?.is_active ?? true
        );

        const targetSectionIds = Array.from(
          new Set(
            activeRules
              .map((rule) => getTargetSectionIdFromRule(rule))
              .filter((sectionId) => Number.isFinite(sectionId) && sectionId > 0)
          )
        );

        if (hasForcedTargetSectionId && !targetSectionIds.includes(forcedTargetSectionId)) {
          targetSectionIds.push(forcedTargetSectionId);
        }

        if (!cancelled) {
          setFlowRules(activeRules);
        }

        if (!targetSectionIds.length) {
          if (!cancelled) {
            setConditionalQuestionSectionsBySectionId({});
            setIsConditionalFlowDataLoading(false);
          }
          return;
        }

        const questionSectionsRes = await requestFn(`${API_BASE}/api/question-sections/`);
        if (!questionSectionsRes.ok) {
          if (!cancelled) {
            setConditionalQuestionSectionsBySectionId({});
            setIsConditionalFlowDataLoading(false);
          }
          return;
        }

        const questionSectionsPayload = await questionSectionsRes.json();
        const allQuestionSections = normalizeApiRows(questionSectionsPayload);
        const targetSectionIdSet = new Set(targetSectionIds);
        const grouped = {};

        allQuestionSections.forEach((questionSection) => {
          const sectionId = Number(
            questionSection?.section_id ??
              questionSection?.section?.section_id ??
              0
          );

          if (!Number.isFinite(sectionId) || !targetSectionIdSet.has(sectionId)) return;

          if (!grouped[sectionId]) grouped[sectionId] = [];
          grouped[sectionId].push(questionSection);
        });

        Object.keys(grouped).forEach((sectionId) => {
          grouped[sectionId] = grouped[sectionId].slice().sort((left, right) => {
            const leftOrder = getQuestionOrder(left) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = getQuestionOrder(right) ?? Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
          });
        });

        if (!cancelled) {
          setConditionalQuestionSectionsBySectionId(grouped);
          setIsConditionalFlowDataLoading(false);
        }
      } catch (error) {
        console.error("Failed to load conditional flow data", error);
        if (!cancelled) {
          setFlowRules([]);
          setConditionalQuestionSectionsBySectionId({});
          setIsConditionalFlowDataLoading(false);
        }
      }
    };

    loadConditionalFlowData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assessmentId, forceConditionalTargetSectionId, requestFn]);

  useEffect(() => {
    if (!isOpen) {
      setIsResolvingRequestedStart(false);
      return;
    }

    const requestedSectionId = Number(startQuestionSectionId);
    const requestedQuestionId = Number(startQuestionId);
    const forcedSourceQuestionId = Number(forceConditionalSourceQuestionId);
    const hasRequestedSectionId = Number.isFinite(requestedSectionId) && requestedSectionId > 0;
    const hasRequestedQuestionId = Number.isFinite(requestedQuestionId) && requestedQuestionId > 0;
    const hasForcedSourceQuestionId =
      Number.isFinite(forcedSourceQuestionId) && forcedSourceQuestionId > 0;

    setIsResolvingRequestedStart(
      hasRequestedSectionId || hasRequestedQuestionId || hasForcedSourceQuestionId
    );
  }, [
    isOpen,
    startQuestionSectionId,
    startQuestionId,
    forceConditionalSourceQuestionId,
  ]);

  const prefillContext = useMemo(() => {
    try {
      const empty = {
        dobYmd: null,
        age: null,
        eventDateYmd: null,
        eventDescription: null,
        firstName: null,
        lastName: null,
        referralCompanyName: null,
      };

      if (!prefillData || typeof prefillData !== "object") {
        return empty;
      }

      const dobParts = parseDateOnlyYmd(
        prefillData?.dob ??
          prefillData?.patientDob ??
          prefillData?.patient_dob ??
          null
      );
      const age = calculateAgeFromDob(dobParts);

      const eventDateParts = parseDateOnlyYmd(
        prefillData?.event_date ??
          prefillData?.eventDate ??
          prefillData?.patient_event_date ??
          null
      );

      const eventDescriptionRaw =
        prefillData?.event ??
          prefillData?.eventDescription ??
          prefillData?.patient_event_description ??
          null;

      const eventDescription =
        typeof eventDescriptionRaw === "string" ? eventDescriptionRaw.trim() : "";

      const firstNameRaw =
        prefillData?.first_name ??
          prefillData?.firstName ??
          prefillData?.patient_first_name ??
          null;
      const lastNameRaw =
        prefillData?.last_name ??
          prefillData?.lastName ??
          prefillData?.patient_last_name ??
          null;

      const firstName = typeof firstNameRaw === "string" ? firstNameRaw.trim() : "";
      const lastName = typeof lastNameRaw === "string" ? lastNameRaw.trim() : "";

      const referralCompanyNameRaw =
        prefillData?.referral_company_name ??
          prefillData?.referralCompanyName ??
          prefillData?.company_name ??
          prefillData?.companyName ??
          null;
      const referralCompanyName =
        typeof referralCompanyNameRaw === "string" ? referralCompanyNameRaw.trim() : "";

      return {
        dobYmd: dobParts?.ymd ?? null,
        age,
        eventDateYmd: eventDateParts?.ymd ?? null,
        eventDescription: eventDescription ? eventDescription : null,
        firstName: firstName ? firstName : null,
        lastName: lastName ? lastName : null,
        referralCompanyName: referralCompanyName ? referralCompanyName : null,
      };
    } catch {
      return {
        dobYmd: null,
        age: null,
        eventDateYmd: null,
        eventDescription: null,
        firstName: null,
        lastName: null,
        referralCompanyName: null,
      };
    }
  }, [prefillData]);

  useEffect(() => {
    if (!isOpen) {
      setIsAttemptReady(false);
      return;
    }

    let cancelled = false;

    const resolveStartIndex = (attemptData) => {
      const requestedStartId = Number(startQuestionSectionId);
      if (Number.isFinite(requestedStartId) && requestedStartId > 0) {
        const requestedIndex = questions.findIndex(
          (item) => Number(item.questionSectionId) === requestedStartId
        );

        if (requestedIndex >= 0) {
          return requestedIndex;
        }
      }

      const attemptQuestionId = getAttemptQuestionIdValue(attemptData);
      if (attemptQuestionId > 0) {
        const questionIndex = questions.findIndex(
          (item) => getQuestionIdForItem(item) === attemptQuestionId
        );
        if (questionIndex >= 0) return questionIndex;
      }

      const attemptSectionId = getAttemptSectionIdValue(attemptData);
      if (attemptSectionId > 0) {
        const sectionIndex = questions.findIndex(
          (item) => getSectionIdForItem(item) === attemptSectionId
        );
        if (sectionIndex >= 0) return sectionIndex;
      }

      return 0;
    };

    const initializeRunState = async () => {
      const initStartedAt = Date.now();
      const perfMarks = {};
      const mark = (label) => {
        perfMarks[label] = Date.now();
      };
      const logInitPerf = (statusLabel, extra = {}) => {
        if (!PERF_DEBUG) return;
        const attemptResolveMs =
          perfMarks.attemptResolvedAt && perfMarks.attemptResolveStartedAt
            ? perfMarks.attemptResolvedAt - perfMarks.attemptResolveStartedAt
            : 0;
        const responseLoadMs =
          perfMarks.responsesLoadedAt && perfMarks.responseLoadStartedAt
            ? perfMarks.responsesLoadedAt - perfMarks.responseLoadStartedAt
            : 0;
        const totalMs = Date.now() - initStartedAt;

        console.info("[RunAssessment Perf]", {
          status: statusLabel,
          attemptResolveMs,
          responseLoadMs,
          totalMs,
          ...extra,
        });
      };

      const getAttemptIdFromResponseItem = (responseItem) => Number(
        responseItem?.attempt?.id ??
        responseItem?.attempt_id ??
        responseItem?.assessment_attempt_id ??
        responseItem?.patient_assessment_attempt_id ??
        responseItem?.patient_assessment_attempt ??
        responseItem?.attempt ??
        0
      );

      const loadResponsesForAttempt = async (resolvedAttemptId) => {
        const responseQueryPaths = [
          `${PATIENT_RESPONSES_HISTORY_API}?assessment_attempt_id=${resolvedAttemptId}`,
          `${PATIENT_RESPONSES_API}?attempt_id=${resolvedAttemptId}`,
          `${PATIENT_RESPONSES_API}?assessment_attempt_id=${resolvedAttemptId}`,
          `${PATIENT_RESPONSES_API}?attempt=${resolvedAttemptId}`,
          `${PATIENT_RESPONSES_API}?patient_assessment_attempt_id=${resolvedAttemptId}`,
        ];

        for (const responsePath of responseQueryPaths) {
          try {
            const scopedRes = await requestFn(responsePath);
            if (!scopedRes.ok) continue;

            const scopedPayload = await scopedRes.json();
            const scopedRows = normalizeApiRows(scopedPayload);
            const scopedMatches = scopedRows.filter(
              (responseItem) => getAttemptIdFromResponseItem(responseItem) === resolvedAttemptId
            );
            const rowsWithKnownAttemptId = scopedRows.filter(
              (responseItem) => getAttemptIdFromResponseItem(responseItem) > 0
            );
            const hasMismatchedAttemptIds = rowsWithKnownAttemptId.some(
              (responseItem) => getAttemptIdFromResponseItem(responseItem) !== resolvedAttemptId
            );

            if (scopedMatches.length > 0) {
              return scopedMatches;
            }

            // Some filtered endpoints omit attempt metadata from each response row.
            // When no known attempt ids contradict the target attempt, trust scoped results.
            if (scopedRows.length > 0 && !hasMismatchedAttemptIds) {
              return scopedRows;
            }

            continue;
          } catch {
            // Try the next candidate path.
          }
        }

        const responsesRes = await requestFn(PATIENT_RESPONSES_API);
        const responsesPayload = await responsesRes.json();
        const allResponses = normalizeApiRows(responsesPayload);
        return allResponses.filter(
          (responseItem) => getAttemptIdFromResponseItem(responseItem) === resolvedAttemptId
        );
      };

      const mapAttemptResponsesToState = (attemptResponses) => {
        const loadedResponses = {};
        const loadedResponseIdByQuestionId = {};

        attemptResponses.forEach((responseItem) => {
          const resolvedQuestionId = getResponseQuestionId(responseItem);
          if (!resolvedQuestionId) return;

          const resolvedAnswerValue =
            responseItem?.answer_value ??
            responseItem?.answerValue ??
            responseItem?.response_value ??
            responseItem?.responseValue ??
            responseItem?.answer ??
            null;

          loadedResponses[resolvedQuestionId] = normalizeStoredAnswerValue(resolvedAnswerValue);
          const responseRecordId = getResponseRecordId(responseItem);
          if (responseRecordId) {
            loadedResponseIdByQuestionId[resolvedQuestionId] = responseRecordId;
          }
        });

        return {
          loadedResponses,
          loadedResponseIdByQuestionId,
        };
      };

      if (!questions.length) {
        setIsAttemptReady(true);
        logInitPerf("no-questions");
        return;
      }

      if (!canPersistAttempts) {
        const basicStartIndex = resolveStartIndex(null);
        if (!cancelled) {
          setCurrentIndex(Math.max(0, basicStartIndex));
          setAttemptId(null);
          responseIdByQuestionIdRef.current = {};
          setResponses({});
          setIsAttemptReady(true);
        }
        logInitPerf("no-persist");
        return;
      }

      setIsAttemptReady(false);

      try {
        let activeAttempt = null;
        mark("attemptResolveStartedAt");

        if (Number.isFinite(numericAttemptIdOverride) && numericAttemptIdOverride > 0) {
          let attemptRes = await requestFn(
            `${PATIENT_ASSESSMENT_ATTEMPTS_API}${numericAttemptIdOverride}/`
          );

          if (!attemptRes.ok && attemptRes.status === 404) {
            attemptRes = await requestFn(
              `${PATIENT_ASSESSMENT_ATTEMPTS_API}${numericAttemptIdOverride}`
            );
          }

          if (attemptRes.ok) {
            const attemptPayload = await attemptRes.json();
            const matchesContext =
              getAttemptPatientIdValue(attemptPayload) === numericPatientId &&
              getAttemptAssessmentIdValue(attemptPayload) === numericAssessmentId;

            if (matchesContext) {
              activeAttempt = attemptPayload;
            } else {
              throw new Error(
                "Resolved attempt id does not match patient/assessment context for this session."
              );
            }
          } else {
            throw new Error(
              `Unable to load attempt ${numericAttemptIdOverride} for this session (status ${attemptRes.status}).`
            );
          }
        }

        if (!activeAttempt && !(Number.isFinite(numericAttemptIdOverride) && numericAttemptIdOverride > 0)) {
          const attemptsRes = await requestFn(PATIENT_ASSESSMENT_ATTEMPTS_API);
          const attemptsPayload = await attemptsRes.json();
          const allAttempts = normalizeApiRows(attemptsPayload);

          const matchingAttempts = allAttempts.filter((attempt) => {
            const attemptStatus = String(attempt?.status ?? "").toLowerCase();
            if (!["assigned", "in_progress"].includes(attemptStatus)) return false;

            return (
              getAttemptPatientIdValue(attempt) === numericPatientId &&
              getAttemptAssessmentIdValue(attempt) === numericAssessmentId
            );
          });

          activeAttempt =
            matchingAttempts.find(
              (attempt) => String(attempt?.status ?? "").toLowerCase() === "in_progress"
            ) || matchingAttempts[0] || null;
        }

        if (!activeAttempt && !(Number.isFinite(numericAttemptIdOverride) && numericAttemptIdOverride > 0)) {
          const defaultItem = questions[0] ?? null;
          const createAttemptRes = await requestFn(PATIENT_ASSESSMENT_ATTEMPTS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: numericPatientId,
              assessment_id: numericAssessmentId,
              status: "in_progress",
              current_question_id: getQuestionIdForItem(defaultItem) || null,
              current_section_id: getSectionIdForItem(defaultItem) || null,
              ...(Number.isFinite(numericPatientEventId) && numericPatientEventId > 0
                ? { patient_event_id: numericPatientEventId }
                : {}),
            }),
          });

          activeAttempt = await createAttemptRes.json();
        }
        mark("attemptResolvedAt");

        const resolvedAttemptId = getAttemptIdValue(activeAttempt);
        if (!resolvedAttemptId) {
          throw new Error("Unable to resolve patient assessment attempt id.");
        }

        const startIndex = Math.max(0, resolveStartIndex(activeAttempt));
        const startItem = questions[startIndex] ?? questions[0] ?? null;

        if (String(activeAttempt?.status ?? "").toLowerCase() !== "in_progress") {
          await requestFn(`${PATIENT_ASSESSMENT_ATTEMPTS_API}${resolvedAttemptId}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "in_progress",
              current_question_id: getQuestionIdForItem(startItem) || null,
              current_section_id: getSectionIdForItem(startItem) || null,
              ...(Number.isFinite(numericPatientEventId) && numericPatientEventId > 0
                ? { patient_event_id: numericPatientEventId }
                : {}),
            }),
          });
        }

        if (!cancelled) {
          setAttemptId(resolvedAttemptId);
          setCurrentIndex(startIndex);
          setResponses({});
          responseIdByQuestionIdRef.current = {};
          setIsAttemptReady(true);
        }

        logInitPerf("ready-shell", {
          attemptId: resolvedAttemptId,
          responseCount: 0,
        });

        mark("responseLoadStartedAt");
        const attemptResponses = await loadResponsesForAttempt(resolvedAttemptId);
        mark("responsesLoadedAt");

        const {
          loadedResponses,
          loadedResponseIdByQuestionId,
        } = mapAttemptResponsesToState(attemptResponses);

        if (!cancelled) {
          // Keep any user-entered values that occurred before background load completed.
          setResponses((prev) => ({
            ...loadedResponses,
            ...prev,
          }));

          responseIdByQuestionIdRef.current = {
            ...loadedResponseIdByQuestionId,
            ...responseIdByQuestionIdRef.current,
          };
        }

        logInitPerf("ready-responses", {
          attemptId: resolvedAttemptId,
          responseCount: attemptResponses.length,
        });
      } catch (error) {
        console.error("Failed to initialize patient assessment attempt", error);
        if (!cancelled) {
          setAttemptId(null);
          responseIdByQuestionIdRef.current = {};
          setCurrentIndex(0);
          setResponses({});
          setIsAttemptReady(true);
        }
        logInitPerf("failed");
      }
    };

    initializeRunState();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    questions,
    startQuestionSectionId,
    canPersistAttempts,
    numericPatientId,
    numericAssessmentId,
    numericPatientEventId,
    numericAttemptIdOverride,
    requestFn,
  ]);

  const highestPriorityRuleBySourceQuestionId = useMemo(() => {
    const bySourceQuestionId = new Map();

    (flowRules || []).forEach((rule) => {
      const sourceQuestionId = getSourceQuestionIdFromRule(rule);
      if (!sourceQuestionId) return;

      const existing = bySourceQuestionId.get(sourceQuestionId);
      if (!existing || getRulePriorityValue(rule) > getRulePriorityValue(existing)) {
        bySourceQuestionId.set(sourceQuestionId, rule);
      }
    });

    return bySourceQuestionId;
  }, [flowRules]);

  const runtimeQuestions = useMemo(() => {
    const expanded = [];
    const forcedSourceQuestionId = Number(forceConditionalSourceQuestionId);
    const forcedTargetSectionId = Number(forceConditionalTargetSectionId);
    const hasForcedSourceQuestionId =
      Number.isFinite(forcedSourceQuestionId) && forcedSourceQuestionId > 0;
    const hasForcedTargetSectionId =
      Number.isFinite(forcedTargetSectionId) && forcedTargetSectionId > 0;

    questions.forEach((item) => {
      expanded.push(item);

      const sourceQuestionId = getQuestionIdForItem(item);
      if (!sourceQuestionId) return;

      const matchingRule = highestPriorityRuleBySourceQuestionId.get(sourceQuestionId);
      const ruleTargetSectionId = getTargetSectionIdFromRule(matchingRule);
      const currentResponseValue = responses[sourceQuestionId];
      const shouldEnterConditionalFlow =
        !!matchingRule &&
        doesRuleMatchResponseValue(matchingRule, currentResponseValue);
      const shouldForceConditionalFlow =
        hasForcedSourceQuestionId &&
        hasForcedTargetSectionId &&
        sourceQuestionId === forcedSourceQuestionId;

      if (!shouldEnterConditionalFlow && !shouldForceConditionalFlow) return;

      const targetSectionId = shouldForceConditionalFlow
        ? forcedTargetSectionId
        : ruleTargetSectionId;
      if (!targetSectionId) return;

      const conditionalQuestions = conditionalQuestionSectionsBySectionId[targetSectionId] || [];
      if (!conditionalQuestions.length) return;

      conditionalQuestions.forEach((questionSection) => {
        expanded.push({
          assessmentSectionId: null,
          sectionId: targetSectionId,
          sectionTitle:
            matchingRule?.target_section?.title ??
            questionSection?.section?.title ??
            item.sectionTitle,
          sectionOrder: Number(item.sectionOrder ?? 0),
          questionOrder: getQuestionOrder(questionSection),
          isRequired: toBooleanRequired(
            questionSection?.is_required ??
              questionSection?.question_section?.is_required ??
              false
          ),
          questionSectionId: Number(
            questionSection?.question_section_id ??
              questionSection?.question_section?.question_section_id ??
              0
          ),
          questionSection,
          question: questionSection?.question ?? {},
          isConditionalFlowQuestion: true,
          conditionalFlowSourceQuestionId: sourceQuestionId,
          conditionalFlowTargetSectionId: targetSectionId,
        });
      });
    });

    if (hasForcedTargetSectionId) {
      const hasForcedTargetInExpanded = expanded.some((item) => (
        item?.isConditionalFlowQuestion &&
        Number(item?.conditionalFlowTargetSectionId) === forcedTargetSectionId
      ));

      if (!hasForcedTargetInExpanded) {
        const fallbackConditionalQuestions =
          conditionalQuestionSectionsBySectionId[forcedTargetSectionId] || [];

        fallbackConditionalQuestions.forEach((questionSection) => {
          expanded.push({
            assessmentSectionId: null,
            sectionId: forcedTargetSectionId,
            sectionTitle:
              questionSection?.section?.title ??
              "Conditional Flow",
            sectionOrder: Number.MAX_SAFE_INTEGER,
            questionOrder: getQuestionOrder(questionSection),
            isRequired: toBooleanRequired(
              questionSection?.is_required ??
                questionSection?.question_section?.is_required ??
                false
            ),
            questionSectionId: Number(
              questionSection?.question_section_id ??
                questionSection?.question_section?.question_section_id ??
                0
            ),
            questionSection,
            question: questionSection?.question ?? {},
            isConditionalFlowQuestion: true,
            conditionalFlowSourceQuestionId: hasForcedSourceQuestionId
              ? forcedSourceQuestionId
              : null,
            conditionalFlowTargetSectionId: forcedTargetSectionId,
          });
        });
      }
    }

    return expanded;
  }, [
    questions,
    responses,
    highestPriorityRuleBySourceQuestionId,
    conditionalQuestionSectionsBySectionId,
    forceConditionalSourceQuestionId,
    forceConditionalTargetSectionId,
  ]);

  useEffect(() => {
    setCurrentIndex((prev) => {
      if (!runtimeQuestions.length) return 0;
      if (prev < 0) return 0;
      if (prev >= runtimeQuestions.length) return runtimeQuestions.length - 1;
      return prev;
    });
  }, [runtimeQuestions]);

  useEffect(() => {
    if (!isOpen) {
      appliedStartRequestRef.current = null;
      return;
    }

    if (!isAttemptReady || !runtimeQuestions.length) return;

    const requestedSectionId = Number(startQuestionSectionId);
    const requestedQuestionId = Number(startQuestionId);
    const forcedSourceQuestionId = Number(forceConditionalSourceQuestionId);
    const forcedTargetSectionId = Number(forceConditionalTargetSectionId);
    const hasRequestedSectionId = Number.isFinite(requestedSectionId) && requestedSectionId > 0;
    const hasRequestedQuestionId = Number.isFinite(requestedQuestionId) && requestedQuestionId > 0;
    const hasForcedSourceQuestionId =
      Number.isFinite(forcedSourceQuestionId) && forcedSourceQuestionId > 0;
    const hasForcedTargetSectionId =
      Number.isFinite(forcedTargetSectionId) && forcedTargetSectionId > 0;

    if (!hasRequestedSectionId && !hasRequestedQuestionId && !hasForcedSourceQuestionId) {
      setIsResolvingRequestedStart(false);
      return;
    }

    const requestKey = `${hasRequestedSectionId ? requestedSectionId : "-"}:${hasRequestedQuestionId ? requestedQuestionId : "-"}:${hasForcedSourceQuestionId ? forcedSourceQuestionId : "-"}:${hasForcedTargetSectionId ? forcedTargetSectionId : "-"}`;
    if (appliedStartRequestRef.current === requestKey) return;

    let targetIndex = -1;

    if (hasRequestedSectionId) {
      targetIndex = runtimeQuestions.findIndex(
        (item) => Number(item?.questionSectionId) === requestedSectionId
      );
    }

    if (targetIndex < 0 && hasRequestedQuestionId) {
      targetIndex = runtimeQuestions.findIndex(
        (item) => getQuestionIdForItem(item) === requestedQuestionId
      );
    }

    if (targetIndex < 0 && hasForcedSourceQuestionId) {
      targetIndex = runtimeQuestions.findIndex((item) => {
        if (!item?.isConditionalFlowQuestion) return false;

        const itemSourceQuestionId = Number(item?.conditionalFlowSourceQuestionId);
        const itemTargetSectionId = Number(item?.conditionalFlowTargetSectionId);

        if (itemSourceQuestionId !== forcedSourceQuestionId) return false;
        if (hasForcedTargetSectionId && itemTargetSectionId !== forcedTargetSectionId) return false;

        return true;
      });
    }

    if (targetIndex >= 0) {
      setCurrentIndex(targetIndex);
      appliedStartRequestRef.current = requestKey;
      setIsResolvingRequestedStart(false);
      return;
    }

    if (!isConditionalFlowDataLoading) {
      appliedStartRequestRef.current = requestKey;
      setIsResolvingRequestedStart(false);
    }
  }, [
    isOpen,
    isAttemptReady,
    isConditionalFlowDataLoading,
    runtimeQuestions,
    startQuestionSectionId,
    startQuestionId,
    forceConditionalSourceQuestionId,
    forceConditionalTargetSectionId,
  ]);

  const totalQuestions = runtimeQuestions.length;
  const currentItem = runtimeQuestions[currentIndex] ?? null;
  const progressPercent =
    totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;
  const question = currentItem?.question ?? {};
  const questionId =
    question?.question_id ??
    currentItem?.questionSection?.question_id ??
    `${currentItem?.sectionId ?? "section"}-${currentItem?.questionOrder ?? currentIndex + 1}`;

  const questionType = normalizeQuestionType(question);
  const isNoResponseQuestion =
    questionType === "no_response" || questionType === "perform_task_video";
  const currentResponse =
    responses[questionId] ?? getInitialResponse(questionType);
  const isCurrentQuestionRequired = !!currentItem?.isRequired;
  const hasCurrentResponse = hasResponseValue(currentResponse);
  const isSignatureDrawQuestion = questionType === "signature_draw";
  const signatureResponse =
    currentResponse && typeof currentResponse === "object" && !Array.isArray(currentResponse)
      ? currentResponse
      : {};
  const hasSignatureDrawing = String(signatureResponse?.signature_data_url ?? "").trim().length > 0;
  const hasSignatureName = String(signatureResponse?.full_name ?? "").trim().length > 0;

  const persistResponseAndAttemptState = async ({
    targetIndex,
    status,
    markComplete = false,
  }) => {
    if (!canPersistAttempts || !attemptId) return;

    const questionNumericId = Number(questionId);
    const hasValidQuestionId = Number.isFinite(questionNumericId) && questionNumericId > 0;
    const answerPayload = currentResponse ?? null;
    const scoreValuePayload = getScoreValueFromAnswer(answerPayload);

    if (hasValidQuestionId) {
      const existingResponseId = responseIdByQuestionIdRef.current[questionNumericId] ?? null;

      const createPatientResponse = async (payloadCandidates) => {
        let lastStatus = null;
        let lastErrorText = "";
        const failureDetails = [];

        for (const payload of payloadCandidates) {
          const createRes = await requestFn(PATIENT_RESPONSES_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (createRes.ok) {
            return createRes;
          }

          lastStatus = createRes.status;
          try {
            lastErrorText = await createRes.text();
          } catch {
            lastErrorText = "";
          }

          failureDetails.push({
            status: createRes.status,
            payload,
            error: lastErrorText,
          });
        }

        throw new Error(
          `Create response failed (${lastStatus ?? "unknown"}) ${lastErrorText} :: ${JSON.stringify(failureDetails)}`
        );
      };

      if (existingResponseId) {
        let patchRes = await requestFn(`${PATIENT_RESPONSES_API}${existingResponseId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer_value: answerPayload,
            score_value: scoreValuePayload,
          }),
        });

        if (!patchRes.ok) {
          patchRes = await requestFn(`${PATIENT_RESPONSES_API}${existingResponseId}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              answer_value: answerPayload,
            }),
          });

          if (!patchRes.ok) {
            const patchErrorBody = await patchRes.text().catch(() => "");
            throw new Error(
              `Update response failed (${patchRes.status}) ${patchErrorBody}`
            );
          }
        }
      } else {
        const requestContext = {
          patientId: Number.isFinite(numericPatientId) && numericPatientId > 0 ? numericPatientId : null,
          assessmentId: Number.isFinite(numericAssessmentId) && numericAssessmentId > 0 ? numericAssessmentId : null,
          sectionId: Number.isFinite(Number(currentItem?.assessmentSectionId))
            ? Number(currentItem?.assessmentSectionId)
            : Number.isFinite(Number(currentItem?.sectionId))
              ? Number(currentItem?.sectionId)
              : null,
          questionTypeId: Number.isFinite(Number(question?.question_type?.question_type_id))
            ? Number(question?.question_type?.question_type_id)
            : Number.isFinite(Number(question?.question_type_id))
              ? Number(question?.question_type_id)
              : null,
        };

        const baseCreatePayload = {
          question_id: questionNumericId,
          answer_value: answerPayload,
          score_value: scoreValuePayload,
        };

        const withOptionalContext = (payload) => ({
          ...payload,
          ...(requestContext.patientId ? { patient_id: requestContext.patientId } : {}),
          ...(requestContext.assessmentId ? { assessment_id: requestContext.assessmentId } : {}),
          ...(requestContext.sectionId ? { section_id: requestContext.sectionId } : {}),
          ...(requestContext.questionTypeId ? { question_type_id: requestContext.questionTypeId } : {}),
        });

        const createPayloadCandidates = [
          withOptionalContext({
            assessment_attempt_id: attemptId,
            ...baseCreatePayload,
          }),
          withOptionalContext({
            patient_assessment_attempt_id: attemptId,
            ...baseCreatePayload,
          }),
          withOptionalContext({
            patient_assessment_attempt: attemptId,
            ...baseCreatePayload,
          }),
          withOptionalContext({
            attempt_id: attemptId,
            ...baseCreatePayload,
          }),
          {
            assessment_attempt_id: attemptId,
            question_id: questionNumericId,
            answer_value: answerPayload,
          },
          {
            patient_assessment_attempt_id: attemptId,
            question_id: questionNumericId,
            answer_value: answerPayload,
          },
          {
            patient_assessment_attempt: attemptId,
            question_id: questionNumericId,
            answer_value: answerPayload,
          },
          {
            attempt_id: attemptId,
            question_id: questionNumericId,
            answer_value: answerPayload,
          },
        ];

        const createResponseRes = await createPatientResponse(createPayloadCandidates);

        const createdResponse = await createResponseRes.json();
        const createdResponseId = getResponseRecordId(createdResponse);
        if (createdResponseId) {
          responseIdByQuestionIdRef.current = {
            ...responseIdByQuestionIdRef.current,
            [questionNumericId]: createdResponseId,
          };
        }
      }
    }

    const targetItem = runtimeQuestions[targetIndex] ?? null;
    const nextQuestionId = getQuestionIdForItem(targetItem) || null;
    const nextSectionId = getSectionIdForItem(targetItem) || null;

    let attemptRes = await requestFn(`${PATIENT_ASSESSMENT_ATTEMPTS_API}${attemptId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        current_question_id: nextQuestionId,
        current_section_id: nextSectionId,
        ...(markComplete ? { completed_at: new Date().toISOString() } : {}),
      }),
    });

    if (!attemptRes.ok) {
      await requestFn(`${PATIENT_ASSESSMENT_ATTEMPTS_API}${attemptId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          current_question_id: nextQuestionId,
          current_section_id: nextSectionId,
          ...(markComplete ? { completed_at: new Date().toISOString() } : {}),
        }),
      });
    }
  };

  const fetchAttemptTotalScore = async (attemptNumericId) => {
    const resolvedAttemptId = Number(attemptNumericId);
    if (!Number.isFinite(resolvedAttemptId) || resolvedAttemptId <= 0) {
      throw new Error("Missing attempt id for total score lookup");
    }

    const fetchJson = async (path) => {
      const res = await requestFn(path);
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        throw new Error(`Total score request failed (${res.status}) ${message}`);
      }
      return res.json();
    };

    try {
      return await fetchJson(`${API_BASE}/api/total-score/${resolvedAttemptId}/`);
    } catch {
      return fetchJson(`${API_BASE}/api/total-score/${resolvedAttemptId}`);
    }
  };

  const clearPersistedResponsesByQuestionIds = async (questionIds) => {
    if (!canPersistAttempts || !questionIds?.length) return;

    const unresolvedQuestionIds = new Set();

    for (const id of questionIds) {
      const numericQuestionId = Number(id);
      if (!Number.isFinite(numericQuestionId) || numericQuestionId <= 0) continue;

      const responseRecordId = responseIdByQuestionIdRef.current[numericQuestionId];
      if (!responseRecordId) {
        unresolvedQuestionIds.add(numericQuestionId);
        continue;
      }

      try {
        await requestFn(`${PATIENT_RESPONSES_API}${responseRecordId}/`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to delete stale conditional response", error);
      }

      delete responseIdByQuestionIdRef.current[numericQuestionId];
    }

    if (!unresolvedQuestionIds.size || !attemptId) return;

    const attemptNumericId = Number(attemptId);
    if (!Number.isFinite(attemptNumericId) || attemptNumericId <= 0) return;

    const responseQueryPaths = [
      `${PATIENT_RESPONSES_HISTORY_API}?assessment_attempt_id=${attemptNumericId}`,
      `${PATIENT_RESPONSES_API}?attempt_id=${attemptNumericId}`,
      `${PATIENT_RESPONSES_API}?assessment_attempt_id=${attemptNumericId}`,
      `${PATIENT_RESPONSES_API}?attempt=${attemptNumericId}`,
      `${PATIENT_RESPONSES_API}?patient_assessment_attempt_id=${attemptNumericId}`,
    ];

    let matchingResponseRows = [];

    for (const responsePath of responseQueryPaths) {
      try {
        const scopedRes = await requestFn(responsePath);
        if (!scopedRes.ok) continue;

        const scopedPayload = await scopedRes.json();
        const scopedRows = normalizeApiRows(scopedPayload);

        matchingResponseRows = scopedRows.filter((responseItem) => {
          const responseQuestionId = getResponseQuestionId(responseItem);
          if (!responseQuestionId || !unresolvedQuestionIds.has(responseQuestionId)) return false;

          const responseAttemptId = getResponseAttemptId(responseItem);
          return !responseAttemptId || responseAttemptId === attemptNumericId;
        });

        if (matchingResponseRows.length) {
          break;
        }
      } catch {
        // Try next endpoint variant.
      }
    }

    for (const responseItem of matchingResponseRows) {
      const responseRecordId = getResponseRecordId(responseItem);
      const responseQuestionId = getResponseQuestionId(responseItem);

      if (!responseRecordId || !responseQuestionId) continue;

      try {
        await requestFn(`${PATIENT_RESPONSES_API}${responseRecordId}/`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error("Failed to delete stale conditional response", error);
      }

      delete responseIdByQuestionIdRef.current[responseQuestionId];
    }
  };

  const clearPersistedResponsesByTargetSectionId = async (targetSectionId) => {
    if (!canPersistAttempts || !attemptId) return;

    const numericTargetSectionId = Number(targetSectionId);
    if (!Number.isFinite(numericTargetSectionId) || numericTargetSectionId <= 0) return;

    const targetQuestionSections = conditionalQuestionSectionsBySectionId[numericTargetSectionId] || [];
    const targetQuestionIds = new Set(
      targetQuestionSections
        .map((questionSection) => Number(questionSection?.question?.question_id ?? 0))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    if (!targetQuestionIds.size) return;

    const attemptNumericId = Number(attemptId);
    if (!Number.isFinite(attemptNumericId) || attemptNumericId <= 0) return;

    const questionIdList = Array.from(targetQuestionIds);
    const questionParam = encodeURIComponent(`[${questionIdList.join(",")}]`);
    const byFilterPath = `${API_BASE}/api/patient-responses/by-filter/?attempt=${attemptNumericId}&question=${questionParam}`;

    try {
      const byFilterRes = await requestFn(byFilterPath, {
        method: "DELETE",
      });

      if (!byFilterRes.ok) {
        const byFilterError = await byFilterRes.text().catch(() => "");
        console.error(
          `Failed to delete conditional target-section responses by filter (${byFilterRes.status}) ${byFilterError}`
        );
      }
    } catch (error) {
      console.error("Failed to delete conditional target-section responses by filter", error);
    }

    questionIdList.forEach((id) => {
      delete responseIdByQuestionIdRef.current[id];
    });
  };

  const setResponse = (value) => {
    const sourceQuestionId = Number(questionId);
    const sourceRule = highestPriorityRuleBySourceQuestionId.get(sourceQuestionId);
    let questionIdsToClear = [];
    let targetSectionIdToClear = null;

    setResponses((prev) => {
      const next = {
        ...prev,
        [questionId]: value,
      };

      if (!sourceRule) return next;

      const matchedAfter = doesRuleMatchResponseValue(sourceRule, value);

      if (!matchedAfter) {
        const targetSectionId = getTargetSectionIdFromRule(sourceRule);
        targetSectionIdToClear = targetSectionId;
        const staleQuestionSections = targetSectionId
          ? conditionalQuestionSectionsBySectionId[targetSectionId] || []
          : [];

        questionIdsToClear = staleQuestionSections
          .map((questionSection) => Number(questionSection?.question?.question_id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0);

        if (questionIdsToClear.length) {
          questionIdsToClear.forEach((id) => {
            delete next[id];
          });
        }
      }

      return next;
    });

    if (questionIdsToClear.length) {
      clearPersistedResponsesByQuestionIds(questionIdsToClear);
    }

    if (targetSectionIdToClear) {
      clearPersistedResponsesByTargetSectionId(targetSectionIdToClear);
    }
  };

  const clearConditionalResponsesForCurrentQuestionWhenFalse = async () => {
    const sourceQuestionId = Number(questionId);
    if (!Number.isFinite(sourceQuestionId) || sourceQuestionId <= 0) return;

    const sourceRule = highestPriorityRuleBySourceQuestionId.get(sourceQuestionId);
    if (!sourceRule) return;

    const matchedNow = doesRuleMatchResponseValue(sourceRule, currentResponse);
    if (matchedNow) return;

    const targetSectionId = getTargetSectionIdFromRule(sourceRule);
    if (!targetSectionId) return;

    const staleQuestionSections = conditionalQuestionSectionsBySectionId[targetSectionId] || [];
    const questionIdsToClear = staleQuestionSections
      .map((questionSection) => Number(questionSection?.question?.question_id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (questionIdsToClear.length) {
      setResponses((prev) => {
        const next = { ...prev };
        questionIdsToClear.forEach((id) => {
          delete next[id];
        });
        return next;
      });

      clearPersistedResponsesByQuestionIds(questionIdsToClear);
    }

    await clearPersistedResponsesByTargetSectionId(targetSectionId);
  };

  useEffect(() => {
    if (!isOpen) return;

    try {
      if (!questionId || !currentItem) return;
      if (questionType === "multi_select" || questionType === "multiple_select") return;
      if (questionType === "no_response") return;

      const storedResponse = responses[questionId];
      if (hasResponseValue(storedResponse)) return;

      if (questionType === "first_last_name_response" || questionType === "first_middle_last_name_response") {
        const nextFirstName = prefillContext?.firstName ?? "";
        const nextLastName = prefillContext?.lastName ?? "";
        if (!nextFirstName && !nextLastName) return;

        setResponses((prev) => {
          const existing = prev[questionId];
          if (hasResponseValue(existing)) return prev;

          const base =
            existing && typeof existing === "object" && !Array.isArray(existing)
              ? existing
              : getInitialResponse(questionType);

          return {
            ...prev,
            [questionId]: {
              ...base,
              ...(nextFirstName ? { first_name: nextFirstName } : {}),
              ...(nextLastName ? { last_name: nextLastName } : {}),
            },
          };
        });

        return;
      }

      const prompt = normalizePrefillPrompt(question?.question);
      const titlePrompt = normalizePrefillPrompt(question?.title);
      if (!prompt && !titlePrompt) return;

      const isReferralCompanyPrompt = (rawPrompt) => {
        const normalized = normalizePrefillPrompt(rawPrompt);
        if (!normalized) return false;
        return (
          normalized === "provider or clinic referring you" ||
          normalized === "referred by" ||
          normalized === "company referral"
        );
      };

      let prefillValue;

      if (prompt === "your age" || prompt === "age" || titlePrompt === "your age" || titlePrompt === "age") {
        if (Number.isFinite(prefillContext?.age)) {
          prefillValue = prefillContext.age;
        }
      } else if (
        prompt === "your date of birth" ||
        prompt === "date of birth" ||
        titlePrompt === "your date of birth" ||
        titlePrompt === "date of birth"
      ) {
        if (prefillContext?.dobYmd) {
          prefillValue = prefillContext.dobYmd;
        }
      } else if (
        prompt === "date of injury" ||
        prompt === "injury date" ||
        prompt === "date of event" ||
        prompt === "event date" ||
        titlePrompt === "date of injury" ||
        titlePrompt === "injury date" ||
        titlePrompt === "date of event" ||
        titlePrompt === "event date"
      ) {
        if (prefillContext?.eventDateYmd) {
          prefillValue = prefillContext.eventDateYmd;
        }
      } else if (
        prompt === "self description of your accident" ||
        prompt === "accident description" ||
        prompt === "event description" ||
        prompt === "self description of the event"
      ) {
        if (prefillContext?.eventDescription) {
          prefillValue = prefillContext.eventDescription;
        }
      } else if (isReferralCompanyPrompt(prompt) || isReferralCompanyPrompt(titlePrompt)) {
        if (prefillContext?.referralCompanyName) {
          prefillValue = prefillContext.referralCompanyName;
        }
      }

      if (prefillValue === undefined || prefillValue === null) return;
      if (typeof prefillValue === "string" && !prefillValue.trim()) return;

      setResponses((prev) => {
        if (hasResponseValue(prev[questionId])) return prev;
        return {
          ...prev,
          [questionId]: prefillValue,
        };
      });
    } catch {
      // fall back to not pre-populating
    }
  }, [
    isOpen,
    questionId,
    questionType,
    question?.question,
    question?.title,
    currentItem,
    responses,
    prefillContext,
  ]);

  const selectOptions = normalizeOptions(question)
    .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0));
  const currentVideoUrl =
    questionType === "perform_task_video" ? String(question?.hyperlink ?? "").trim() : "";
  const currentVideoSource = getVideoSource(currentVideoUrl);
  const currentYouTubeVideoId =
    currentVideoSource.kind === "embed" ? getYouTubeEmbedVideoId(currentVideoSource.url) : "";
  const isYouTubeFallbackActive = Boolean(
    youtubeEmbedFallbackByQuestionId[String(questionId)]
  );
  const requiresVideoCompletion =
    questionType === "perform_task_video" &&
    (currentVideoSource.kind === "native" || (Boolean(currentYouTubeVideoId) && !isYouTubeFallbackActive));
  const isCurrentVideoCompleted = Boolean(videoCompletionByQuestionId[questionId]);
  const isMissingRequiredResponse = isCurrentQuestionRequired && (
    isSignatureDrawQuestion
      ? (!hasSignatureDrawing || !hasSignatureName)
      : (!isNoResponseQuestion && !hasCurrentResponse)
  );
  const isMissingRequiredVideoCompletion =
    isCurrentQuestionRequired && requiresVideoCompletion && !isCurrentVideoCompleted;
  const optionColumnClass =
    selectOptions.length > 15
      ? "three-col"
      : selectOptions.length > 8
        ? "two-col"
        : "one-col";
  const scaleConfig = getScaleResponseConfig(questionType);
  const isScaleResponseQuestion = Boolean(scaleConfig);

  const companyName =
    selectedCompany?.company_name ??
    selectedCompany?.name ??
    "Valhalla";

  const companyLogoUrl =
    selectedCompany?.logo_url ??
    selectedCompany?.logo ??
    selectedCompany?.company_logo ??
    selectedCompany?.image_url ??
    selectedCompany?.image ??
    selectedCompany?.icon_url ??
    DEFAULT_BRAND_LOGO_URL;

  const companyInitials = String(companyName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join("") || "V";

  useEffect(() => {
    if (!isOpen || !requiresVideoCompletion) return;

    setVideoCompletionByQuestionId((prev) => {
      if (prev[questionId] !== undefined) return prev;
      return {
        ...prev,
        [questionId]: false,
      };
    });
  }, [isOpen, requiresVideoCompletion, questionId]);

  useEffect(() => {
    let cancelled = false;

    const destroyPlayer = () => {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.destroy === "function") {
        youtubePlayerRef.current.destroy();
      }
      youtubePlayerRef.current = null;

      const container = youtubeContainerRef.current;
      const mountNode = youtubeMountNodeRef.current;
      if (container && mountNode && container.contains(mountNode)) {
        container.removeChild(mountNode);
      }

      youtubeMountNodeRef.current = null;
    };

    if (
      !isOpen ||
      !isAttemptReady ||
      questionType !== "perform_task_video" ||
      !currentYouTubeVideoId ||
      youtubeEmbedFallbackByQuestionId[String(questionId)]
    ) {
      destroyPlayer();
      return;
    }

    const youtubeTimeoutMs = 4500;
    const youtubeLoader = Promise.race([
      loadYouTubeIframeApi(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("YouTube API timeout")), youtubeTimeoutMs);
      }),
    ]);

    youtubeLoader
      .then((YT) => {
        if (cancelled) return;

        if (!youtubeContainerRef.current) {
          return;
        }

        if (!YT?.Player) {
          setYoutubeEmbedFallbackByQuestionId((prev) => ({
            ...prev,
            [String(questionId)]: true,
          }));
          return;
        }

        destroyPlayer();

        const mountNode = document.createElement("div");
        mountNode.style.width = "100%";
        mountNode.style.height = "100%";
        youtubeContainerRef.current.appendChild(mountNode);
        youtubeMountNodeRef.current = mountNode;

        try {
          youtubePlayerRef.current = new YT.Player(mountNode, {
            videoId: currentYouTubeVideoId,
            width: "100%",
            height: "100%",
            playerVars: {
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              autoplay: 0,
            },
            events: {
              onReady: (event) => {
                event.target.cueVideoById({
                  videoId: currentYouTubeVideoId,
                  startSeconds: 0,
                });
              },
              onStateChange: (event) => {
                if (event.data === YT.PlayerState.ENDED) {
                  setVideoCompletionByQuestionId((prev) => ({
                    ...prev,
                    [questionId]: true,
                  }));
                  event.target.cueVideoById({
                    videoId: currentYouTubeVideoId,
                    startSeconds: 0,
                  });
                }
              },
            },
          });
        } catch {
          destroyPlayer();
          setYoutubeEmbedFallbackByQuestionId((prev) => ({
            ...prev,
            [String(questionId)]: true,
          }));
        }
      })
      .catch(() => {
        destroyPlayer();
        if (!cancelled) {
          setYoutubeEmbedFallbackByQuestionId((prev) => ({
            ...prev,
            [String(questionId)]: true,
          }));
        }
      });

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [
    isOpen,
    isAttemptReady,
    questionType,
    currentYouTubeVideoId,
    questionId,
    youtubeEmbedFallbackByQuestionId,
  ]);

  if (!isOpen) return null;

  if (!currentItem) {
    return (
      <div className="run-assessment-overlay">
        <div className="run-assessment-brand-badge" aria-label="company-brand">
          <div className="run-assessment-brand-logo-wrap">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={`${companyName} logo`}
                className="run-assessment-brand-logo"
              />
            ) : (
              <div className="run-assessment-brand-fallback">{companyInitials}</div>
            )}
          </div>
          <div className="run-assessment-brand-name">{companyName}</div>
        </div>

        <div className="run-assessment-modal">
          <div className="run-assessment-frame">
            <div className="run-assessment-persistent-header">
              <div className="run-assessment-header-top">
                <div className="run-assessment-header-left">
                  <h3>{assessmentName || "Assessment"}</h3>
                </div>
                <div className="run-assessment-header-right">
                  <button type="button" className="run-assessment-close" onClick={onClose}>✕</button>
                </div>
              </div>

              <div className="run-assessment-progress-wrap">
                <div className="run-assessment-progress-bar" aria-hidden="true">
                  <div
                    className="run-assessment-progress-fill"
                    style={{ width: "0%" }}
                  />
                </div>
                <div className="run-assessment-progress-label">
                  Question 0 of 0
                </div>
              </div>
            </div>

            <div className="run-assessment-shell run-assessment-shell-static">
              <div className="run-assessment-empty">No questions available for this assessment.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const logSelectedAnswer = (direction) => {
    console.log(`[RunAssessment] ${direction}`, {
      question_id: questionId,
      section_order: currentItem.sectionOrder,
      question_order: currentItem.questionOrder,
      question_title: question?.title ?? "",
      selected_answer: currentResponse,
    });
  };

  const transitionToIndex = (nextIndex, direction) => {
    if (isAnimatingShell) return;

    const shellElement = shellRef.current;

    if (!shellElement) {
      setCurrentIndex(nextIndex);
      return;
    }

    const shellRect = shellElement.getBoundingClientRect();
    const clone = shellElement.cloneNode(true);
    clone.classList.add("run-assessment-shell-clone");
    clone.classList.add(
      direction === "forward"
        ? "run-assessment-shell-exit-left"
        : "run-assessment-shell-exit-right"
    );

    clone.style.position = "fixed";
    clone.style.top = `${shellRect.top}px`;
    clone.style.left = `${shellRect.left}px`;
    clone.style.width = `${shellRect.width}px`;
    clone.style.height = `${shellRect.height}px`;
    clone.style.margin = "0";
    clone.style.zIndex = "1700";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    setIsAnimatingShell(true);
    setShellEnterClass(
      direction === "forward"
        ? "run-assessment-shell-enter-right"
        : "run-assessment-shell-enter-left"
    );
    setCurrentIndex(nextIndex);

    window.setTimeout(() => {
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
      setShellEnterClass("");
      setIsAnimatingShell(false);
    }, shellAnimationDurationMs);
  };

  const goPrevious = () => {
    logSelectedAnswer("Previous");
    const nextIndex = Math.max(0, currentIndex - 1);
    if (nextIndex === currentIndex) return;

    transitionToIndex(nextIndex, "backward");

    const perform = async () => {
      if (canPersistAttempts && attemptId) {
        try {
          await persistResponseAndAttemptState({
            targetIndex: nextIndex,
            status: "in_progress",
          });
        } catch (error) {
          console.error("Failed to persist previous navigation", error);
        }
      }
    };

    perform();
  };

  const goNext = () => {
    if (isMissingRequiredResponse || isMissingRequiredVideoCompletion) return;
    const nextIndex = Math.min(totalQuestions - 1, currentIndex + 1);
    if (nextIndex === currentIndex) return;

    transitionToIndex(nextIndex, "forward");

    const perform = async () => {
      try {
        await clearConditionalResponsesForCurrentQuestionWhenFalse();
      } catch (error) {
        console.error("Failed to clear conditional responses on next", error);
      }

      if (canPersistAttempts && attemptId) {
        try {
          await persistResponseAndAttemptState({
            targetIndex: nextIndex,
            status: "in_progress",
          });
        } catch (error) {
          console.error("Failed to persist next navigation", error);
        }
      }
    };

    perform();
  };

  const submitAssessment = () => {
    if (isSubmitting) return;
    if (isMissingRequiredResponse || isMissingRequiredVideoCompletion) return;

    logSelectedAnswer("Submit");
    console.log("[RunAssessment] Submit payload", {
      assessment_name: assessmentName || "Assessment",
      total_questions: totalQuestions,
      responses,
    });

    const perform = async () => {
      setIsSubmitting(true);
      try {
        if (canPersistAttempts && attemptId) {
          try {
            await persistResponseAndAttemptState({
              targetIndex: currentIndex,
              status: "completed",
              markComplete: true,
            });

            try {
              const payload = await fetchAttemptTotalScore(attemptId);
              const totalScoreValue = toFiniteNumberOrNull(payload?.total_score) ?? 0;

              const endpoint = `${PATIENT_ASSESSMENT_ATTEMPTS_API}${attemptId}/`;

              const parseJsonOrText = async (response) => {
                try {
                  return await response.json();
                } catch {
                  try {
                    return { detail: await response.text() };
                  } catch {
                    return {};
                  }
                }
              };

              const patchAttempt = async (body) => {
                const res = await requestFn(endpoint, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    status: "completed",
                    ...body,
                  }),
                });

                const parsedBody = await parseJsonOrText(res);
                return { res, body: parsedBody };
              };

              const didSetFinalScore = (attemptPayload) => {
                const updatedValue = toFiniteNumberOrNull(attemptPayload?.final_score);
                if (updatedValue === null) return false;
                return Math.abs(updatedValue - totalScoreValue) < 0.0001;
              };

              const attempts = [
                { field: "final_score", value: totalScoreValue },
                { field: "score", value: totalScoreValue },
                { field: "total_score", value: totalScoreValue },
              ];

              let lastFailure = null;
              for (const attempt of attempts) {
                const { res, body } = await patchAttempt({ [attempt.field]: attempt.value });
                if (!res.ok) {
                  lastFailure = new Error(
                    `Attempt score update failed via ${attempt.field} (${res.status}) ${JSON.stringify(body)}`
                  );
                  continue;
                }

                if (didSetFinalScore(body)) {
                  lastFailure = null;
                  break;
                }

                // PATCH succeeded but didn't actually set final_score (likely read-only/ignored).
                lastFailure = new Error(
                  `Attempt score update via ${attempt.field} did not update final_score. Response: ${JSON.stringify(body)}`
                );
              }

              if (lastFailure) {
                throw lastFailure;
              }
            } catch (scoreError) {
              console.error("Failed to update attempt final score", scoreError);
            }
          } catch (error) {
            console.error("Failed to persist submit", error);
          }
        }
      } finally {
        setIsSubmitting(false);
      }

      onSubmitComplete?.();
      onClose?.();
    };

    perform();
  };

  if (!isAttemptReady || isResolvingRequestedStart) {
    return (
      <div className="run-assessment-overlay">
        <div className="run-assessment-modal">
          <div className="run-assessment-frame">
            <div className="run-assessment-persistent-header">
              <div className="run-assessment-header-top">
                <div className="run-assessment-header-left">
                  <h3>{assessmentName || "Assessment"}</h3>
                </div>
                <div className="run-assessment-header-right">
                  <button type="button" className="run-assessment-close" onClick={onClose}>✕</button>
                </div>
              </div>
            </div>
            <div className="run-assessment-shell run-assessment-shell-static">
              <div className="run-assessment-empty">
                {isResolvingRequestedStart
                  ? "Opening selected question..."
                  : "Loading assessment progress..."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderResponseField = () => {
    if (scaleConfig) {
      const parsedCurrent = Number(currentResponse);
      const sliderValue = Number.isFinite(parsedCurrent)
        ? parsedCurrent
        : scaleConfig.defaultValue;
      const percent =
        scaleConfig.max > scaleConfig.min
          ? ((sliderValue - scaleConfig.min) / (scaleConfig.max - scaleConfig.min)) * 100
          : 50;

      return (
        <div className="run-assessment-slider-wrap">
          <div className="run-assessment-slider-control">
            <input
              type="range"
              min={scaleConfig.min}
              max={scaleConfig.max}
              step={scaleConfig.step}
              value={sliderValue}
              onChange={(event) => setResponse(Number(event.target.value))}
              className="run-assessment-slider"
            />
            <div
              className="run-assessment-slider-thumb-value"
              style={{ left: `${percent}%` }}
              aria-hidden="true"
            >
              {sliderValue}
            </div>
          </div>
          <div className="run-assessment-slider-meta">
            <span>{scaleConfig.min}</span>
            <span>{scaleConfig.max}</span>
          </div>
        </div>
      );
    }

    switch (questionType) {
      case "free_response":
        return (
          <input
            type="text"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      case "email_response":
        return (
          <input
            type="email"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      case "date_response":
        return (
          <input
            type="date"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      case "number_response":
        return (
          <input
            type="number"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      case "phone_number_response":
        return (
          <input
            type="tel"
            value={formatPhoneInput(currentResponse)}
            onChange={(event) => setResponse(formatPhoneInput(event.target.value))}
            className="run-assessment-input"
          />
        );
      case "first_last_name_response":
        return (
          <div className="run-assessment-name-grid two-col">
            <input
              type="text"
              placeholder="First Name"
              value={currentResponse?.first_name ?? ""}
              onChange={(event) =>
                setResponse({
                  ...currentResponse,
                  first_name: event.target.value,
                })
              }
              className="run-assessment-input"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={currentResponse?.last_name ?? ""}
              onChange={(event) =>
                setResponse({
                  ...currentResponse,
                  last_name: event.target.value,
                })
              }
              className="run-assessment-input"
            />
          </div>
        );
      case "first_middle_last_name_response":
        return (
          <div className="run-assessment-name-grid three-col">
            <input
              type="text"
              placeholder="First Name"
              value={currentResponse?.first_name ?? ""}
              onChange={(event) =>
                setResponse({
                  ...currentResponse,
                  first_name: event.target.value,
                })
              }
              className="run-assessment-input"
            />
            <input
              type="text"
              placeholder="Middle Name"
              value={currentResponse?.middle_name ?? ""}
              onChange={(event) =>
                setResponse({
                  ...currentResponse,
                  middle_name: event.target.value,
                })
              }
              className="run-assessment-input"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={currentResponse?.last_name ?? ""}
              onChange={(event) =>
                setResponse({
                  ...currentResponse,
                  last_name: event.target.value,
                })
              }
              className="run-assessment-input"
            />
          </div>
        );
      case "free_response_long":
        return (
          <textarea
            rows={5}
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-textarea"
          />
        );
      case "signature_draw":
        return (
          <SignatureDrawField
            value={currentResponse}
            onChange={setResponse}
          />
        );
      case "no_response":
        return null;
      case "perform_task_video": {
        const videoUrl = currentVideoUrl;
        const videoSource = currentVideoSource;

        if (!videoUrl) {
          return (
            <div className="run-assessment-video-empty">
              No video link is available for this question.
            </div>
          );
        }

        return (
          <div className="run-assessment-video-wrap">
            {videoSource.kind === "native" ? (
              <video
                className="run-assessment-video-frame"
                controls
                playsInline
                preload="metadata"
                src={videoSource.url}
                onEnded={() =>
                  setVideoCompletionByQuestionId((prev) => ({
                    ...prev,
                    [questionId]: true,
                  }))
                }
              >
                Your browser does not support the video tag.
              </video>
            ) : videoSource.kind === "embed" && currentYouTubeVideoId && !isYouTubeFallbackActive ? (
              <div
                ref={youtubeContainerRef}
                className="run-assessment-video-frame"
              />
            ) : videoSource.kind === "embed" ? (
              <iframe
                title={`question-video-${questionId}`}
                src={videoSource.url}
                className="run-assessment-video-frame"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="run-assessment-video-empty">
                This video host blocks in-app playback. Use the link below to open it.
              </div>
            )}
          </div>
        );
      }
      case "multi_select":
      case "multiple_select":
        if (selectOptions.length > 0) {
          const selectedItems = Array.isArray(currentResponse) ? currentResponse : [];

          const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

          const buildOptionIdentity = (optionItem) => {
            const order = Number(optionItem?.order);
            if (Number.isFinite(order)) {
              return `order:${order}`;
            }

            const optionLabel = normalizeText(optionItem?.option);
            if (optionLabel) {
              return `option:${optionLabel}`;
            }

            const optionValue = normalizeText(optionItem?.value);
            return optionValue ? `value:${optionValue}` : "";
          };

          const buildItemIdentity = (item) => {
            if (item && typeof item === "object") {
              const order = Number(item?.order);
              if (Number.isFinite(order)) {
                return `order:${order}`;
              }

              const optionLabel = normalizeText(item?.option);
              if (optionLabel) {
                return `option:${optionLabel}`;
              }

              const optionValue = normalizeText(item?.value);
              return optionValue ? `value:${optionValue}` : "";
            }

            const primitiveOrder = Number(item);
            if (Number.isFinite(primitiveOrder)) {
              return `order:${primitiveOrder}`;
            }

            const primitiveText = normalizeText(item);
            return primitiveText ? `option:${primitiveText}` : "";
          };

          const matchesOption = (item, optionItem) => {
            const itemIdentity = buildItemIdentity(item);
            const optionIdentity = buildOptionIdentity(optionItem);
            return Boolean(itemIdentity) && Boolean(optionIdentity) && itemIdentity === optionIdentity;
          };

          const toggleOption = (optionItem) => {
            const optionOrder = Number(optionItem.order);

            setResponse((() => {
              const exists = selectedItems.some((item) => matchesOption(item, optionItem));

              if (exists) {
                return selectedItems.filter((item) => !matchesOption(item, optionItem));
              }

              return [
                ...selectedItems,
                {
                  order: optionOrder,
                  option: optionItem.option,
                  value: optionItem.value,
                },
              ];
            })());
          };

          return (
            <div className={`run-assessment-radio-group ${optionColumnClass}`}>
              {selectOptions.map((optionItem) => {
                const checked = selectedItems.some((item) => matchesOption(item, optionItem));

                return (
                  <label className="run-assessment-radio-row" key={`${optionItem.order}-${optionItem.option}`}>
                    <input
                      type="checkbox"
                      name={`question-${questionId}-multi`}
                      checked={checked}
                      onChange={() => toggleOption(optionItem)}
                    />
                    <span>{optionItem.option}</span>
                  </label>
                );
              })}
            </div>
          );
        }

        return (
          <input
            type="text"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      case "single_select":
      case "general_occurence_single_answer":
        if (selectOptions.length > 0) {
          const selectedOrder = getSelectedOptionOrder(currentResponse);

          return (
            <div className={`run-assessment-radio-group ${optionColumnClass}`}>
              {selectOptions.map((optionItem) => {
                const optionOrder = Number(optionItem.order);
                const checked = Number.isFinite(selectedOrder) && selectedOrder === optionOrder;

                return (
                  <label className="run-assessment-radio-row" key={`${optionItem.order}-${optionItem.option}`}>
                    <input
                      type="radio"
                      name={`question-${questionId}`}
                      value={optionOrder}
                      checked={checked}
                      onChange={() =>
                        setResponse({
                          order: optionOrder,
                          option: optionItem.option,
                          value: optionItem.value,
                        })
                      }
                    />
                    <span>{optionItem.option}</span>
                  </label>
                );
              })}
            </div>
          );
        }

        return (
          <input
            type="text"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
      default:
        if (selectOptions.length > 0) {
          const selectedOrder = getSelectedOptionOrder(currentResponse);

          return (
            <div className={`run-assessment-radio-group ${optionColumnClass}`}>
              {selectOptions.map((optionItem) => {
                const optionOrder = Number(optionItem.order);
                const checked = Number.isFinite(selectedOrder) && selectedOrder === optionOrder;
                return (
                  <label className="run-assessment-radio-row" key={`${optionItem.order}-${optionItem.option}`}>
                    <input
                      type="radio"
                      name={`question-${questionId}`}
                      value={optionOrder}
                      checked={checked}
                      onChange={() =>
                        setResponse({
                          order: optionOrder,
                          option: optionItem.option,
                          value: optionItem.value,
                        })
                      }
                    />
                    <span>{optionItem.option}</span>
                  </label>
                );
              })}
            </div>
          );
        }

        return (
          <input
            type="text"
            value={String(currentResponse ?? "")}
            onChange={(event) => setResponse(event.target.value)}
            className="run-assessment-input"
          />
        );
    }
  };

  return (
    <div className="run-assessment-overlay">
      <div className="run-assessment-brand-badge" aria-label="company-brand">
        <div className="run-assessment-brand-logo-wrap">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={`${companyName} logo`}
              className="run-assessment-brand-logo"
            />
          ) : (
            <div className="run-assessment-brand-fallback">{companyInitials}</div>
          )}
        </div>
        <div className="run-assessment-brand-name">{companyName}</div>
      </div>

      <div className="run-assessment-modal">
        <div className="run-assessment-frame">
          <div className="run-assessment-persistent-header">
            <div className="run-assessment-header-top">
              <div className="run-assessment-header-left">
                <h3>{assessmentName || "Assessment"}</h3>
              </div>
              <div className="run-assessment-header-right">
                {showMetadataToggle && (
                  <label className="run-assessment-metadata-toggle">
                    <input
                      type="checkbox"
                      checked={showMetadata}
                      onChange={(event) => setShowMetadata(event.target.checked)}
                    />
                    <span>Show Metadata</span>
                  </label>
                )}
                <button type="button" className="run-assessment-close" onClick={onClose}>✕</button>
              </div>
            </div>

            <div className="run-assessment-progress-wrap">
              <div className="run-assessment-progress-bar" aria-hidden="true">
                <div
                  className="run-assessment-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="run-assessment-progress-label">
                Question {currentIndex + 1} of {totalQuestions}
              </div>
            </div>
          </div>

        <div
          ref={shellRef}
          className={`run-assessment-shell ${shellEnterClass}`}
        >
          <div className="run-assessment-card">
            {showMetadata && (
              <>
                <div className="run-assessment-meta">
                  <span>Section {currentItem.sectionOrder}: {currentItem.sectionTitle}</span>
                  <span>Section ID: {currentItem.sectionId}</span>
                  <span>Question {currentIndex + 1} of {totalQuestions}</span>
                </div>

                <div className="run-assessment-submeta">
                  <span>Question ID: {questionId}</span>
                  <span>Section Question Order: {currentItem.questionOrder && currentItem.questionOrder > 0 ? currentItem.questionOrder : "null"}</span>
                  <span>Title: {question?.title || "Untitled Question"}</span>
                  <span>Type: {questionType || "—"}</span>
                </div>
              </>
            )}
            {(isNoResponseQuestion || isScaleResponseQuestion) && (
              <h4 className="run-assessment-question-title">
                {question?.title || "Untitled Question"}
              </h4>
            )}

            <p
              className={`run-assessment-question-text ${
                isNoResponseQuestion || isScaleResponseQuestion
                  ? "run-assessment-question-text-normal"
                  : ""
              }`}
            >
              {question?.question || "No question text provided."}
              {isCurrentQuestionRequired && (
                <span className="run-assessment-required-marker" aria-label="required"> *</span>
              )}
            </p>

            <div className="run-assessment-response-area">
              {renderResponseField()}
            </div>

            <div className="run-assessment-nav">
              <button
                type="button"
                className="run-assessment-link run-assessment-link-prev"
                onClick={goPrevious}
                disabled={currentIndex === 0}
              >
                <span className="run-assessment-arrow" aria-hidden="true">←</span>
                <span>Previous</span>
              </button>
              <button
                type="button"
                className="run-assessment-link run-assessment-link-next"
                onClick={currentIndex === totalQuestions - 1 ? submitAssessment : goNext}
                disabled={
                  isSubmitting ||
                  isMissingRequiredResponse ||
                  isMissingRequiredVideoCompletion
                }
              >
                <span>{currentIndex === totalQuestions - 1 ? "SUBMIT" : "Next"}</span>
                {currentIndex !== totalQuestions - 1 && (
                  <span className="run-assessment-arrow" aria-hidden="true">→</span>
                )}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
