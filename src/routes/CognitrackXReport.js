import React from "react";
import {
  FaBook,
  FaBrain,
  FaCalendarAlt,
  FaCheckCircle,
  FaCheckSquare,
  FaChevronRight,
  FaClipboardCheck,
  FaExclamationCircle,
  FaLightbulb,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaRegCircle,
  FaShieldAlt,
  FaStethoscope,
  FaUserMd,
} from "react-icons/fa";

const pageStyle = {
  minHeight: "100%",
  background: "linear-gradient(180deg, #0b1220 0%, #111c31 100%)",
  color: "#e8eef9",
  fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
};

const shellStyle = {
  maxWidth: "1040px",
  margin: "0 auto",
  padding: "20px 18px 36px",
};

const cardStyle = {
  background: "#17233a",
  border: "1px solid #253551",
  borderRadius: "12px",
  boxShadow: "0 18px 36px rgba(0, 0, 0, 0.24)",
};

const mutedTextStyle = {
  color: "#98a6c3",
};

const formatReportFieldValue = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || "—";
};

const formatAttemptCompletedDate = (value) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getAttemptMetricValue = (attempt, ...fieldNames) => {
  for (const fieldName of fieldNames) {
    if (!fieldName) continue;
    const rawValue = attempt?.[fieldName];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
};

const unwrapResponseItem = (responseItem) =>
  responseItem?.patient_response ??
  responseItem?.response ??
  responseItem?.patient_response_history ??
  responseItem?.history_record ??
  responseItem;

const getResponseQuestionId = (responseItem) =>
  Number(
    unwrapResponseItem(responseItem)?.question?.question_id ??
      unwrapResponseItem(responseItem)?.question_id ??
      unwrapResponseItem(responseItem)?.question ??
      0
  ) || 0;

const getResponseCalcValue = (responseItem) => {
  const resolvedResponse = unwrapResponseItem(responseItem);
  const rawCalcValue =
    resolvedResponse?.calc_value ??
    resolvedResponse?.calcValue ??
    resolvedResponse?.calculated_value ??
    resolvedResponse?.calculatedValue ??
    0;

  const numericCalcValue = Number(rawCalcValue);
  return Number.isFinite(numericCalcValue) ? numericCalcValue : 0;
};

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

const getResponseAnswerValue = (responseItem) =>
  normalizeStoredAnswerValue(
    unwrapResponseItem(responseItem)?.answer_value ??
      unwrapResponseItem(responseItem)?.answerValue ??
      unwrapResponseItem(responseItem)?.response_value ??
      unwrapResponseItem(responseItem)?.responseValue ??
      unwrapResponseItem(responseItem)?.answer ??
      null
  );

const getResponseByQuestionId = (responses, questionId) =>
  (responses || []).find((responseItem) => getResponseQuestionId(responseItem) === questionId) || null;

const extractOptionValues = (answerValue) => {
  if (Array.isArray(answerValue)) {
    return answerValue.flatMap((entry) => extractOptionValues(entry));
  }

  if (answerValue && typeof answerValue === "object") {
    if (Object.prototype.hasOwnProperty.call(answerValue, "option")) {
      const normalized = String(answerValue.option ?? "").trim();
      return normalized ? [normalized] : [];
    }

    return Object.values(answerValue).flatMap((entry) => extractOptionValues(entry));
  }

  return [];
};

const extractReportVerbiageValues = (answerValue) => {
  if (Array.isArray(answerValue)) {
    return answerValue.flatMap((entry) => extractReportVerbiageValues(entry));
  }

  if (answerValue && typeof answerValue === "object") {
    if (Object.prototype.hasOwnProperty.call(answerValue, "report_verbiage")) {
      const normalized = String(answerValue.report_verbiage ?? "").trim();
      return normalized ? [normalized] : [];
    }

    return Object.values(answerValue).flatMap((entry) => extractReportVerbiageValues(entry));
  }

  return [];
};

const countPositiveAnswerValueEntries = (answerValue) => {
  if (Array.isArray(answerValue)) {
    return answerValue.reduce((total, entry) => total + countPositiveAnswerValueEntries(entry), 0);
  }

  if (answerValue && typeof answerValue === "object") {
    if (Object.prototype.hasOwnProperty.call(answerValue, "value")) {
      const numericValue = Number(answerValue.value);
      return Number.isFinite(numericValue) && numericValue > 0 ? 1 : 0;
    }

    return Object.values(answerValue).reduce(
      (total, entry) => total + countPositiveAnswerValueEntries(entry),
      0
    );
  }

  return 0;
};

const formatOptionList = (optionValues) => {
  const normalizedOptions = Array.from(
    new Set(
      optionValues
        .map((optionValue) => String(optionValue ?? "").trim())
        .filter(Boolean)
    )
  );

  if (normalizedOptions.length === 0) return "";
  if (normalizedOptions.length === 1) return normalizedOptions[0];
  if (normalizedOptions.length === 2) return `${normalizedOptions[0]} or ${normalizedOptions[1]}`;

  return `${normalizedOptions.slice(0, -1).join(", ")}, or ${normalizedOptions[normalizedOptions.length - 1]}`;
};

const reportData = {
  reportTitle: "CogniTrackX Report Status",
  reportSubtext:
    "This view recreates the design language and report sections from the redacted CogniTrackX PDF using placeholder data.",
  approvalText: "Report currently in review for redacted sample display",
  patient: {
    heading: "TBI Screening Report - CognitrackX",
    fields: [
      { label: "Full Name", value: "Redacted Patient" },
      { label: "Date of Birth", value: "01/12/1987" },
      { label: "Date of Injury", value: "03/08/2026" },
      { label: "Date of Assessment", value: "04/28/2026" },
    ],
  },
  concerns: [
    { label: "LOC", description: "Loss of consciousness", level: "Endorsed" },
    { label: "AOC", description: "Alteration of consciousness", level: "Endorsed" },
    { label: "PTA", description: "Post-traumatic amnesia", level: "Endorsed" },
  ],
  indicators: [
    {
      title: "LOC - Loss of Consciousness",
      body:
        "A period during which the patient was unresponsive and unaware of their environment following the injury event. Per ACRM criteria, any documented LOC — regardless of duration — is a primary indicator of TBI. LOC lasting up to 30 minutes is consistent with mild TBI; duration exceeding 30 minutes indicates moderate-to-severe classification.",
    },
    {
      title: "AOC - Alteration of Consciousness",
      body:
        "A state of confusion, disorientation, or feeling \"dazed\" immediately following the injury, without a complete loss of consciousness. ACRM guidelines recognize AOC as a qualifying criterion for mild TBI, as it reflects a transient disruption of normal brain function. Patients may describe feeling \"foggy,\" confused, or unable to think clearly in the immediate aftermath of injury.",
    },
    {
      title: "PTA - Post-Traumatic Amnesia",
      body:
        "A period following the injury during which the patient is unable to form or retain new memories, even if they appear conscious and ambulatory. ACRM defines PTA as a key indicator of TBI severity: PTA lasting less than 24 hours is consistent with mild TBI; 1–7 days indicates moderate TBI; greater than 7 days indicates severe TBI. PTA is frequently underreported as patients often cannot accurately recall this period themselves.",
    },
  ],
  metricCards: [
    { label: "TBI Inquiry Severity", value: "4", note: "out of 4" },
    { label: "Acute TBI Markers", value: "14", note: "criteria noted" },
    { label: "Current Symptoms", value: "17", note: "tracked items" },
  ],
  timelineGroups: [
    {
      title: "Pre-Injury Symptoms",
      color: "linear-gradient(90deg, #0f766e 0%, #1d4ed8 100%)",
      summaryCount: "4 symptoms",
      summaryDescription: "Symptoms reported as present prior to the injury event",
      summaryPills: ["Headaches", "Fatigue", "Mood Impairments", "Executive Dysfunction"],
      hideEvents: true,
      events: [
        { headline: "Headaches", detail: "Occasional tension headaches before accident" },
        { headline: "Mood + Stress", detail: "Intermittent anxiety during high-demand periods" },
        { headline: "Sleep", detail: "Mild inconsistent sleep quality" },
      ],
    },
    {
      title: "Symptoms Within 72 Hours of Injury",
      color: "linear-gradient(90deg, #0f766e 0%, #1d4ed8 100%)",
      summaryCount: "14 symptoms",
      summaryCountStyle: {
        background: "rgba(245, 158, 11, 0.26)",
        border: "1px solid rgba(245, 158, 11, 0.42)",
        color: "#fef3c7",
      },
      summaryDescription:
        "Symptoms appeared or worsened within 72 hours, suggesting acute neurological disruption consistent with concussion or mild TBI",
      summaryPills: [
        "Headaches",
        "Dizziness",
        "Fatigue",
        "Sensitivity To Light/Noise",
        "Sleep Disturbances",
        "Balance Problems",
        "Memory Problems",
        "Chronic Pain (Associated with Injury Event)",
        "Executive Dysfunction",
        "Impaired Relationships",
        "Cognitive Fatigue",
        "Speech Impairment",
        "Attention Impairment",
        "Reduced Libido",
      ],
      hideEvents: true,
      events: [
        { headline: "Confusion", detail: "Difficulty processing information and following conversation" },
        { headline: "Head Pressure", detail: "Persistent pressure sensation with activity intolerance" },
        { headline: "Light Sensitivity", detail: "Photophobia and visual discomfort" },
      ],
    },
    {
      title: "Persisting, Worsening, or Newly Emerged Symptoms",
      color: "linear-gradient(90deg, #0f766e 0%, #1d4ed8 100%)",
      summaryCount: "17 symptoms",
      summaryCountStyle: {
        background: "rgba(249, 115, 22, 0.26)",
        border: "1px solid rgba(249, 115, 22, 0.42)",
        color: "#ffedd5",
      },
      summaryDescription:
        "Symptoms that have persisted, worsened, or newly developed — suggestive of post-concussive syndrome",
      summaryPills: [
        "Headaches",
        "Fatigue",
        "Sensitivity To Light/Noise",
        "Sleep Disturbances",
        "Mood Impairments",
        "Balance Problems",
        "Memory Problems",
        "Chronic Pain (Associated with Injury Event)",
        "Executive Dysfunction",
        "Impaired Relationships",
        "Disorientation",
        "Cognitive Fatigue",
        "Speech Impairment",
        "Attention Impairment",
        "Reduced Libido",
        "Occupational Or Educational Difficulty",
        "Reduced Quality of Life",
      ],
      hideEvents: true,
      events: [
        { headline: "Fatigue", detail: "Reduced stamina during cognitive tasks" },
        { headline: "Memory", detail: "Forgetting appointments and recent details" },
        { headline: "Balance", detail: "Intermittent disequilibrium with exertion" },
      ],
    },
  ],
  summary:
    "The patient meets all criteria for a likely traumatic brain injury and continues to report a high burden of persistent, worsening, or newly emerging symptoms. This symptom profile is highly consistent with post-concussive syndrome and may affect cognitive function, emotional regulation, and daily activity. Recommendation: Formal referral for neurocognitive evaluation and multidisciplinary concussion rehabilitation is advised. Coordinated care may include cognitive therapy, vestibular rehabilitation, and behavioral health support depending on symptom complexity.",
  outline: [
    {
      step: "STEP 1",
      title: "Formal Diagnosis & Full Neurocognitive Evaluation",
      icon: FaClipboardCheck,
      useStepPill: true,
      introText:
        "A formal diagnosis is critical at this juncture. The CogniTrackX screening provides an initial indicator of neurocognitive impact, but a comprehensive clinical evaluation is required to establish diagnosis, severity, and a personalized treatment pathway.",
      requiredEvaluations: [
        {
          title: "Formal TBI Diagnosis",
          description: "By a board-certified neurologist or neuropsychologist with documented TBI specialization.",
        },
        {
          title: "Full Neurocognitive Evaluation",
          description:
            "Comprehensive assessment of memory, attention, processing speed, and executive function using validated instruments.",
        },
        {
          title: "Neurobehavioral Scoring & Assessment",
          description:
            "Evaluating emotional regulation, impulse control, and behavioral changes post-injury through standardized behavioral instruments.",
        },
        {
          title: "Baseline Functional Assessment",
          description:
            "Documents pre-treatment functional status to enable accurate ongoing comparison and treatment progress tracking.",
        },
      ],
      neuroimagingDescription:
        "Depending on the findings of the formal diagnosis and full evaluation, advanced neuroimaging may be indicated:",
      neuroimagingEvaluations: [
        {
          title: "MRI-DTI (Diffusion Tensor Imaging)",
          description:
            "The gold standard for identifying white matter tract damage not visible on standard MRI — highly recommended for moderate-to-severe presentations.",
        },
        {
          title: "Standard MRI or CT",
          description:
            "Indicated where acute structural findings such as hemorrhage or contusion are suspected.",
        },
        {
          title: "Functional Neuroimaging (fMRI or SPECT)",
          description:
            "For complex or chronic presentations where structural imaging may be insufficient to capture functional deficits.",
        },
      ],
      documentationStandard:
        "Providers selected for evaluation should fully document and report all data findings using quantitative, validated scoring instruments. Thorough clinical documentation is essential for both treatment continuity and any associated legal proceedings.",
    },
    {
      step: "STEP 2",
      title: "Treatment Plan & Therapeutic Interventions",
      icon: FaBrain,
      useStepPill: true,
      introText:
        "Based on Valhalla Health's clinical experience across more than 50,000 TBI treatments, the following evidence-informed and documented protocols have demonstrated meaningful efficacy in TBI recovery. Treatment plans should be individualized to the patient's specific diagnosis, symptom profile, and functional goals.",
      protocolSections: [
        {
          heading: "CELLULAR & NEUROMODULATION PROTOCOLS",
          items: [
            {
              title: "Photobiomodulation (PBM) Therapy",
              description: "Documented light-based protocols targeting neuroinflammation and mitochondrial function.",
            },
            {
              title: "Neuromodulation Protocols",
              description: "Including tDCS and related modalities targeting neural circuit regulation and recovery.",
            },
            {
              title: "Nebulized Exosome Therapy",
              description: "Emerging regenerative protocol demonstrating efficacy in neuroinflammation and recovery support.",
            },
          ],
        },
        {
          heading: "PHYSICAL & SENSORIMOTOR REHABILITATION",
          items: [
            {
              title: "Vestibular Rehabilitation",
              description:
                "Critical for patients presenting with dizziness, balance deficits, or post-concussive vestibular dysfunction — a highly common TBI sequela.",
            },
            {
              title: "Neuro-Ocular Motor Rehabilitation",
              description:
                "Addressing vision processing disruptions, convergence insufficiency, and saccadic dysfunction — common following TBI and frequently underdiagnosed.",
            },
            {
              title: "Physical Therapy (TBI-Specific Protocols)",
              description:
                "Targeting fatigue management, coordination deficits, and functional mobility with protocols adapted for post-TBI presentations.",
            },
          ],
        },
        {
          heading: "COGNITIVE & BEHAVIORAL THERAPIES",
          description: "The following psychotherapeutic modalities have shown particular efficacy in TBI populations:",
          items: [
            {
              title: "Cognitive Behavioral Therapy (CBT)",
              description:
                "Specifically adapted protocols for post-injury cognitive and emotional dysregulation — well-supported by TBI outcome literature.",
            },
            {
              title: "EMDR (Eye Movement Desensitization and Reprocessing)",
              description:
                "Particularly effective where trauma and TBI co-occur, which is common in motor vehicle accident and assault populations.",
            },
            {
              title: "ART (Accelerated Resolution Therapy)",
              description:
                "A rapid, evidence-based trauma therapy with growing TBI application data and strong patient-reported outcomes.",
            },
            {
              title: "Cognitive Rehabilitation Therapy (CRT)",
              description:
                "Structured, systematic retraining of memory, attention, and executive function through individualized cognitive exercises.",
            },
          ],
        },
      ],
    },
    {
      step: "STEP 3",
      title: "Comorbid Psychological Assessment",
      icon: FaStethoscope,
      useStepPill: true,
      introText:
        "TBI frequently co-occurs with significant psychological sequelae that require independent evaluation and treatment. Failure to identify and address these conditions can substantially impede recovery and functional outcomes.",
      protocolSections: [
        {
          heading: "ASSESSMENTS WARRANTED",
          items: [
            {
              title: "Depression Screening",
              description:
                "Using validated instruments (PHQ-9, BDI-II) given the high prevalence of post-TBI depressive disorder across all severity levels.",
            },
            {
              title: "Anxiety Evaluation",
              description:
                "Generalized anxiety and panic presentations are common post-injury and require targeted intervention — often undertreated in TBI populations.",
            },
            {
              title: "PTSD Assessment",
              description:
                "Particularly where the injury occurred in the context of a traumatic event. Use of PCL-5 or clinician-administered CAPS-5 is recommended.",
            },
            {
              title: "Sleep Disorder Screening",
              description:
                "Disrupted sleep architecture is both a symptom and a driver of TBI recovery impairment — identifying and treating sleep disorders significantly improves overall outcomes.",
            },
          ],
        },
      ],
      protocolNote:
        "These assessments should be conducted by licensed mental health professionals with documented TBI experience. Providers must use standardized, validated instruments and report quantitative scoring for all evaluations — narrative-only reports are insufficient.",
    },
    {
      step: "STEP 4",
      title: "Provider Selection & Documentation Standards",
      icon: FaUserMd,
      useStepPill: true,
      introText:
        "The quality and completeness of clinical documentation directly impacts both patient outcomes and the strength of any associated legal case. Valhalla Health strongly recommends the following standards when selecting providers across all steps of this plan:",
      protocolSections: [
        {
          items: [
            {
              title: "Structured, Standardized Documentation",
              description:
                "Select providers who utilize structured documentation protocols for all evaluations and treatment sessions, not narrative-only notes.",
            },
            {
              title: "Quantitative Scoring on Validated Instruments",
              description:
                "Ensure all providers generate numerical scores on validated tools — these are critical for establishing severity, tracking progress, and supporting expert testimony.",
            },
            {
              title: "Regular Progress Documentation",
              description:
                "Require documentation at defined intervals throughout the treatment course to demonstrate treatment response and functional change over time.",
            },
            {
              title: "Legally Defensible Reporting Capability",
              description:
                "Confirm that providers can produce comprehensive, structured reports suitable for expert review and use in legal proceedings.",
            },
            {
              title: "Documented TBI Clinical Experience",
              description:
                "Where possible, engage providers with specific TBI clinical experience and verifiable patient outcome data, general practitioners are insufficient for complex TBI cases.",
            },
          ],
        },
      ],
      protocolNote:
        "Valhalla Health’s Neuro Sentinel network can connect your firm with credentialed providers meeting these documentation standards nationwide. Contact your Valhalla Health representative for a provider referral in your region.",
    },
  ],
  footer: {
    title: "DISCLAIMER",
    body:
      "This document is intended to support clinical recommendations and neurocognitive screening by offering critical analysis of neuropsychological evaluations and relevant scientific literature. It may help inform decisions about further assessment, referral, or care planning. This document is not intended to serve as a formal medical or psychological diagnosis. Diagnostic conclusions must be made by a qualified provider following direct evaluation and integration of comprehensive clinical data.",
    signature: "VALHALLA HEALTH",
  },
};

function StatusBadge({ children, tone = "default" }) {
  const tones = {
    default: {
      background: "rgba(34, 197, 94, 0.12)",
      color: "#86efac",
      border: "1px solid rgba(34, 197, 94, 0.28)",
    },
    alert: {
      background: "rgba(248, 113, 113, 0.12)",
      color: "#fca5a5",
      border: "1px solid rgba(248, 113, 113, 0.24)",
    },
  };

  return (
    <span
      style={{
        ...tones[tone],
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 10px",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 700,
      }}
    >
      <FaCheckCircle style={{ fontSize: "0.72rem" }} />
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle, subtitleNode, gradient, centered = false, largeTitle = false, badge, titleSize }) {
  return (
    <div
      style={{
        background: gradient,
        padding: "11px 14px",
        borderRadius: "10px 10px 0 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        textAlign: centered ? "center" : "left",
      }}
    >
      {badge ? (
        <div style={{ marginBottom: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 11px",
              borderRadius: "999px",
              background: badge.background || "rgba(255,255,255,0.2)",
              border: badge.border || "1px solid rgba(255,255,255,0.3)",
              color: badge.color || "#ffffff",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {badge.label}
          </span>
        </div>
      ) : null}
      <div style={{ fontWeight: 800, fontSize: titleSize || (largeTitle ? "1.45rem" : "0.95rem"), color: "#ffffff" }}>{title}</div>
      {subtitleNode ? (
        <div style={{ marginTop: "3px", fontSize: largeTitle ? "0.98rem" : "0.76rem", color: "rgba(255,255,255,0.84)" }}>{subtitleNode}</div>
      ) : subtitle ? (
        <div style={{ marginTop: "3px", fontSize: largeTitle ? "0.98rem" : "0.76rem", color: "rgba(255,255,255,0.84)" }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function TimelineGroup({ group }) {
  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div
        style={{
          background: group.color,
          padding: "11px 14px",
          borderRadius: "10px 10px 0 0",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#ffffff" }}>{group.title}</div>
          {group.summaryCount ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 10px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.24)",
                color: "#ffffff",
                fontSize: "0.72rem",
                fontWeight: 700,
                ...group.summaryCountStyle,
              }}
            >
              {group.summaryCount}
            </div>
          ) : null}
        </div>
        {group.subtitle ? (
          <div style={{ marginTop: "3px", fontSize: "0.76rem", color: "rgba(255,255,255,0.84)" }}>{group.subtitle}</div>
        ) : null}
        {group.tag ? (
          <div style={{ marginTop: group.subtitle ? "2px" : "3px", fontSize: "0.76rem", color: "rgba(255,255,255,0.84)" }}>{group.tag}</div>
        ) : null}
      </div>
      <div style={{ padding: "14px" }}>
        {group.summaryDescription ? (
          <div style={{ ...mutedTextStyle, fontSize: "0.82rem", lineHeight: 1.6, marginBottom: "12px" }}>{group.summaryDescription}</div>
        ) : null}
        {group.summaryPills?.length ? (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            {group.summaryPills.map((pill) => {
              const isHighlighted = Boolean(group.highlightedPillSet?.has(pill));

              return (
                <div
                  key={`${group.title}-${pill}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: isHighlighted ? "rgba(251, 191, 36, 0.18)" : "rgba(125, 211, 252, 0.08)",
                    border: isHighlighted ? "1px solid rgba(251, 191, 36, 0.45)" : "1px solid rgba(125, 211, 252, 0.18)",
                    color: isHighlighted ? "#fde68a" : "#dbeafe",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    boxShadow: isHighlighted ? "inset 0 0 0 1px rgba(245, 158, 11, 0.12)" : "none",
                  }}
                >
                  {pill}
                </div>
              );
            })}
          </div>
        ) : null}
        {!group.hideEvents
          ? group.events.map((event, index) => (
              <div
                key={`${group.title}-${event.headline}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 1fr",
                  gap: "10px",
                  paddingBottom: index === group.events.length - 1 ? 0 : "12px",
                  marginBottom: index === group.events.length - 1 ? 0 : "12px",
                  borderBottom: index === group.events.length - 1 ? "none" : "1px solid #24324e",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", paddingTop: "2px" }}>
                  <FaRegCircle style={{ color: "#7dd3fc", fontSize: "0.78rem" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#f8fbff", fontSize: "0.9rem" }}>{event.headline}</div>
                  <div style={{ ...mutedTextStyle, fontSize: "0.8rem", marginTop: "4px", lineHeight: 1.55 }}>{event.detail}</div>
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function OutlineStep({ item }) {
  const Icon = item.icon;
  const hasCustomEvaluationLayout = Array.isArray(item.requiredEvaluations);
  const hasCustomProtocolLayout = Array.isArray(item.protocolSections);

  return (
    <div style={{ ...cardStyle, padding: "16px", marginBottom: "14px" }}>
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "999px",
            background: "rgba(96, 165, 250, 0.14)",
            color: "#93c5fd",
            border: "1px solid rgba(96, 165, 250, 0.24)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
            <div>
              {item.useStepPill ? (
                <div style={{ marginBottom: "8px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 11px",
                      borderRadius: "999px",
                      background: "rgba(96, 165, 250, 0.16)",
                      border: "1px solid rgba(96, 165, 250, 0.3)",
                      color: "#bfdbfe",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {item.step}
                  </span>
                </div>
              ) : (
                <div style={{ color: "#60a5fa", fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.08em" }}>{item.step}</div>
              )}
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1rem", marginTop: "4px" }}>{item.title}</div>
              {item.subtitle ? <div style={{ ...mutedTextStyle, fontSize: "0.82rem", marginTop: "5px" }}>{item.subtitle}</div> : null}
            </div>
            {!item.useStepPill ? <StatusBadge>{item.step} active</StatusBadge> : null}
          </div>

          {hasCustomEvaluationLayout ? (
            <div style={{ marginTop: "14px" }}>
              <div style={{ ...mutedTextStyle, fontSize: "0.84rem", lineHeight: 1.65 }}>{item.introText}</div>
              <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.06em", marginTop: "16px", marginBottom: "10px" }}>
                REQUIRED EVALUATIONS
              </div>
              {item.requiredEvaluations.map((evaluation, index) => (
                <div
                  key={`${item.step}-${evaluation.title}`}
                  style={{
                    display: "flex",
                    gap: "9px",
                    alignItems: "flex-start",
                    paddingBottom: index === item.requiredEvaluations.length - 1 ? 0 : "12px",
                    marginBottom: index === item.requiredEvaluations.length - 1 ? 0 : "12px",
                    borderBottom: index === item.requiredEvaluations.length - 1 ? "none" : "1px solid #24324e",
                  }}
                >
                  <FaCheckSquare style={{ color: "#7dd3fc", marginTop: "2px", flexShrink: 0, fontSize: "0.82rem" }} />
                  <div>
                    <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.84rem" }}>{evaluation.title}</div>
                    <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.55, marginTop: "4px" }}>{evaluation.description}</div>
                  </div>
                </div>
              ))}

              <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.06em", marginTop: "18px", marginBottom: "8px" }}>
                NEUROIMAGING — WHEN WARRANTED
              </div>
              <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "12px" }}>{item.neuroimagingDescription}</div>
              {item.neuroimagingEvaluations.map((evaluation, index) => (
                <div
                  key={`${item.step}-${evaluation.title}`}
                  style={{
                    display: "flex",
                    gap: "9px",
                    alignItems: "flex-start",
                    paddingBottom: index === item.neuroimagingEvaluations.length - 1 ? 0 : "12px",
                    marginBottom: index === item.neuroimagingEvaluations.length - 1 ? 0 : "12px",
                    borderBottom: index === item.neuroimagingEvaluations.length - 1 ? "none" : "1px solid #24324e",
                  }}
                >
                  <FaCheckSquare style={{ color: "#7dd3fc", marginTop: "2px", flexShrink: 0, fontSize: "0.82rem" }} />
                  <div>
                    <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.84rem" }}>{evaluation.title}</div>
                    <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.55, marginTop: "4px" }}>{evaluation.description}</div>
                  </div>
                </div>
              ))}

              <div
                style={{
                  marginTop: "18px",
                  background: "rgba(125, 211, 252, 0.08)",
                  border: "1px solid rgba(125, 211, 252, 0.18)",
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.82rem", marginBottom: "6px" }}>Documentation standard:</div>
                <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.6 }}>{item.documentationStandard}</div>
              </div>
            </div>
          ) : hasCustomProtocolLayout ? (
            <div style={{ marginTop: "14px" }}>
              <div style={{ ...mutedTextStyle, fontSize: "0.84rem", lineHeight: 1.65 }}>{item.introText}</div>

              {item.protocolSections.map((section, sectionIndex) => (
                <div key={`${item.step}-${section.heading || sectionIndex}`} style={{ marginTop: sectionIndex === 0 ? "16px" : "18px" }}>
                  {section.heading ? (
                    <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.82rem", letterSpacing: "0.06em", marginBottom: "8px" }}>
                      {section.heading}
                    </div>
                  ) : null}
                  {section.description ? (
                    <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "12px" }}>{section.description}</div>
                  ) : null}
                  {section.items.map((entry, index) => (
                    <div
                      key={`${item.step}-${section.heading}-${entry.title}`}
                      style={{
                        display: "flex",
                        gap: "9px",
                        alignItems: "flex-start",
                        paddingBottom: index === section.items.length - 1 ? 0 : "12px",
                        marginBottom: index === section.items.length - 1 ? 0 : "12px",
                        borderBottom: index === section.items.length - 1 ? "none" : "1px solid #24324e",
                      }}
                    >
                      <FaCheckSquare style={{ color: "#7dd3fc", marginTop: "2px", flexShrink: 0, fontSize: "0.82rem" }} />
                      <div>
                        <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.84rem" }}>{entry.title}</div>
                        <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.55, marginTop: "4px" }}>{entry.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {item.protocolNote ? (
                <div
                  style={{
                    marginTop: "18px",
                    background: "rgba(125, 211, 252, 0.08)",
                    border: "1px solid rgba(125, 211, 252, 0.18)",
                    borderRadius: "10px",
                    padding: "12px",
                  }}
                >
                  <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.6 }}>{item.protocolNote}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", marginTop: "14px" }}>
                {item.sections.map((section) => (
                  <div key={`${item.step}-${section.heading}`} style={{ background: "#121c2e", border: "1px solid #263556", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.86rem", marginBottom: "8px" }}>{section.heading}</div>
                    {section.items.map((entry) => (
                      <div key={entry} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "flex-start" }}>
                        <FaChevronRight style={{ color: "#7dd3fc", marginTop: "3px", flexShrink: 0, fontSize: "0.7rem" }} />
                        <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.5 }}>{entry}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: "14px",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  background: "rgba(125, 211, 252, 0.08)",
                  border: "1px solid rgba(125, 211, 252, 0.18)",
                  color: "#cfe9fb",
                  fontSize: "0.82rem",
                  lineHeight: 1.55,
                }}
              >
                {item.callout}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CognitrackXReport({ assessmentName = "Assessment", reportFields = {}, reportAttempt = null, assessmentResponses = [] }) {
  const resolvedClassification = String(reportAttempt?.classification ?? "").trim() || "Likely TBI";
  const normalizedClassification = resolvedClassification.toLowerCase();
  const completedAtLabel = formatAttemptCompletedDate(reportAttempt?.completed_at ?? reportAttempt?.completedAt);
  const reportHeaderDescription = "This report requires Valhalla Health Staff approval before firm users can access it.";
  const approvalBadgeText = completedAtLabel
    ? `Approved by Valhalla Health Staff ${completedAtLabel}`
    : "Approved by Valhalla Health Staff";
  const classificationPillStyle = normalizedClassification === "improbable tbi"
    ? {
        background: "rgba(20, 83, 45, 0.22)",
        border: "1px solid rgba(134, 239, 172, 0.3)",
        color: "#dcfce7",
      }
    : normalizedClassification === "probable tbi"
      ? {
          background: "rgba(120, 53, 15, 0.28)",
          border: "1px solid rgba(251, 191, 36, 0.45)",
          color: "#fef3c7",
        }
      : {
          background: "rgba(127, 29, 29, 0.34)",
          border: "1px solid rgba(248, 113, 113, 0.4)",
          color: "#fee2e2",
        };
  const classificationIconColor = normalizedClassification === "probable tbi" ? "#fbbf24" : "#f87171";
  const showClassificationAlertIcon = normalizedClassification !== "improbable tbi";
  const baselineResponse = getResponseByQuestionId(assessmentResponses, 31);
  const acuteResponse = getResponseByQuestionId(assessmentResponses, 33);
  const currentResponse = getResponseByQuestionId(assessmentResponses, 35);
  const selfReportedLocPrimaryResponse = getResponseByQuestionId(assessmentResponses, 18);
  const selfReportedLocSecondaryResponse = getResponseByQuestionId(assessmentResponses, 19);
  const witnessedLocResponse = getResponseByQuestionId(assessmentResponses, 20);
  const selfReportedAocPrimaryResponse = getResponseByQuestionId(assessmentResponses, 22);
  const selfReportedAocSecondaryResponse = getResponseByQuestionId(assessmentResponses, 23);
  const witnessedAocResponse = getResponseByQuestionId(assessmentResponses, 24);
  const storedLocSelfScore = getAttemptMetricValue(reportAttempt, "loc_self_score", "locSelfScore");
  const storedLocWitnessScore = getAttemptMetricValue(reportAttempt, "loc_witness_score", "locWitnessScore");
  const storedAocSelfScore = getAttemptMetricValue(reportAttempt, "aoc_self_score", "aocSelfScore");
  const storedAocWitnessScore = getAttemptMetricValue(reportAttempt, "aoc_witness_score", "aocWitnessScore");
  const storedPtaSelfScore = getAttemptMetricValue(reportAttempt, "pta_self_score", "ptaSelfScore");
  const storedPtaWitnessScore = getAttemptMetricValue(reportAttempt, "pta_witness_score", "ptaWitnessScore");
  const storedSymptomProgressionScore = getAttemptMetricValue(
    reportAttempt,
    "symptom_progression_score",
    "symptomProgressionScore"
  );
  const baselineCalcValue = countPositiveAnswerValueEntries(getResponseAnswerValue(baselineResponse));
  const acuteCalcValue = countPositiveAnswerValueEntries(getResponseAnswerValue(acuteResponse));
  const currentCalcValue = countPositiveAnswerValueEntries(getResponseAnswerValue(currentResponse));
  const selfReportedLocPrimaryCalcValue = getResponseCalcValue(selfReportedLocPrimaryResponse);
  const selfReportedLocSecondaryCalcValue = getResponseCalcValue(selfReportedLocSecondaryResponse);
  const witnessedLocCalcValue = getResponseCalcValue(witnessedLocResponse);
  const selfReportedAocPrimaryCalcValue = getResponseCalcValue(selfReportedAocPrimaryResponse);
  const selfReportedAocSecondaryCalcValue = getResponseCalcValue(selfReportedAocSecondaryResponse);
  const witnessedAocCalcValue = getResponseCalcValue(witnessedAocResponse);
  const baselineOptionSet = new Set(extractOptionValues(getResponseAnswerValue(baselineResponse)));
  const preInjurySymptomPills = Array.from(
    new Set(extractOptionValues(getResponseAnswerValue(baselineResponse)))
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const symptomsWithin72HoursPills = Array.from(
    new Set(extractOptionValues(getResponseAnswerValue(acuteResponse)))
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const persistingSymptomsPills = Array.from(
    new Set(extractOptionValues(getResponseAnswerValue(currentResponse)))
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const symptomsWithin72HoursHighlightedSet = new Set(
    symptomsWithin72HoursPills.filter((optionValue) => !baselineOptionSet.has(optionValue))
  );
  const persistingSymptomsHighlightedSet = new Set(
    persistingSymptomsPills.filter((optionValue) => !baselineOptionSet.has(optionValue))
  );
  const acuteNewOptionTally = extractOptionValues(getResponseAnswerValue(acuteResponse)).filter(
    (optionValue) => !baselineOptionSet.has(optionValue)
  ).length;
  const currentAboveBaselineTally = extractOptionValues(getResponseAnswerValue(currentResponse)).filter(
    (optionValue) => !baselineOptionSet.has(optionValue)
  ).length;
  const selfReportedLocSecondaryOptionList = formatOptionList(
    extractReportVerbiageValues(getResponseAnswerValue(selfReportedLocSecondaryResponse))
  );
  const witnessedLocOptionList = formatOptionList(
    extractReportVerbiageValues(getResponseAnswerValue(witnessedLocResponse))
  );
  const selfReportedAocSecondaryOptionList = formatOptionList(
    extractReportVerbiageValues(getResponseAnswerValue(selfReportedAocSecondaryResponse))
  );
  const witnessedAocOptionList = formatOptionList(
    extractReportVerbiageValues(getResponseAnswerValue(witnessedAocResponse))
  );
  const selfReportedLocSecondaryDescription = selfReportedLocSecondaryOptionList
    ? `The patient described substantial loss of consciousness, including ${selfReportedLocSecondaryOptionList}. This supports a neurologic disruption consistent with concussion.`
    : "The patient described substantial loss of consciousness. This supports a neurologic disruption consistent with concussion.";
  const witnessedLocDescription = witnessedLocOptionList
    ? `Witness accounts included subtle indicators of possible unconsciousness, such as ${witnessedLocOptionList}, but no definitive loss of awareness was observed.`
    : "Witness accounts included subtle indicators of possible unconsciousness, but no definitive loss of awareness was observed.";
  const selfReportedAocSecondaryDescription = selfReportedAocSecondaryOptionList
    ? `The patient described substantial loss of consciousness, including being ${selfReportedAocSecondaryOptionList}. This supports a neurologic disruption consistent with concussion.`
    : "The patient described substantial loss of consciousness. This supports a neurologic disruption consistent with concussion.";
  const witnessedAocDescription = witnessedAocOptionList
    ? `Witness accounts included subtle indicators of possible unconsciousness, such as ${witnessedAocOptionList}, but no definitive loss of awareness was observed.`
    : "Witness accounts included subtle indicators of possible unconsciousness, but no definitive loss of awareness was observed.";
  const resolvedLocConcernScore =
    storedLocSelfScore !== null || storedLocWitnessScore !== null
      ? (storedLocSelfScore ?? 0) + (storedLocWitnessScore ?? 0)
      : selfReportedLocPrimaryCalcValue + selfReportedLocSecondaryCalcValue + witnessedLocCalcValue;
  const resolvedAocConcernScore =
    storedAocSelfScore !== null || storedAocWitnessScore !== null
      ? (storedAocSelfScore ?? 0) + (storedAocWitnessScore ?? 0)
      : selfReportedAocPrimaryCalcValue + selfReportedAocSecondaryCalcValue + witnessedAocCalcValue;
  const resolvedPtaConcernScore =
    storedPtaSelfScore !== null || storedPtaWitnessScore !== null
      ? (storedPtaSelfScore ?? 0) + (storedPtaWitnessScore ?? 0)
      : 0;
  const resolvedSymptomProgressionScore =
    storedSymptomProgressionScore !== null
      ? storedSymptomProgressionScore
      : currentAboveBaselineTally;
  const highlightAcuteSummaryCard = acuteCalcValue > baselineCalcValue;
  const highlightCurrentSummaryCard = currentCalcValue > baselineCalcValue;
  const showSelfReportedLocPrimaryCard = selfReportedLocPrimaryCalcValue > 0;
  const showSelfReportedLocSecondaryCard = !showSelfReportedLocPrimaryCard && selfReportedLocSecondaryCalcValue > 0;
  const showWitnessedLocCard = witnessedLocCalcValue > 0;
  const showSelfReportedAocPrimaryCard = selfReportedAocPrimaryCalcValue > 0;
  const showSelfReportedAocSecondaryCard = !showSelfReportedAocPrimaryCard && selfReportedAocSecondaryCalcValue > 0;
  const showWitnessedAocCard = witnessedAocCalcValue > 0;

  const visibleConcerns = reportData.concerns.filter((concern) => {
    if (concern.label === "LOC") {
      return resolvedLocConcernScore > 0;
    }

    if (concern.label === "AOC") {
      return resolvedAocConcernScore > 0;
    }

    if (concern.label === "PTA") {
      return resolvedPtaConcernScore > 0;
    }

    return true;
  });
  const visibleConcernLabels = new Set(visibleConcerns.map((concern) => concern.label));
  const visibleIndicators = reportData.indicators.filter((indicator) => {
    const indicatorLabel = indicator.title.split(" - ")[0];

    return visibleConcernLabels.has(indicatorLabel);
  });

  const resolvedPatientFields = [
    { label: "Full Name", value: formatReportFieldValue(reportFields.fullName) },
    { label: "Date of Birth", value: formatReportFieldValue(reportFields.dateOfBirth) },
    { label: "Date of Injury", value: formatReportFieldValue(reportFields.dateOfInjury) },
    { label: "Date of Assessment", value: formatReportFieldValue(reportFields.dateOfAssessment) },
  ];

  const resolvedReportData = {
    ...reportData,
    patient: {
      ...reportData.patient,
      fields: resolvedPatientFields,
    },
  };
  const formatSymptomCount = (pillValues) => `${pillValues.length} symptom${pillValues.length === 1 ? "" : "s"}`;
  const resolvedTimelineGroups = reportData.timelineGroups.map((group) => {
    if (group.title === "Pre-Injury Symptoms") {
      return {
        ...group,
        summaryCount: formatSymptomCount(preInjurySymptomPills),
        summaryPills: preInjurySymptomPills,
      };
    }

    if (group.title === "Symptoms Within 72 Hours of Injury") {
      return {
        ...group,
        highlightedPillSet: symptomsWithin72HoursHighlightedSet,
        summaryCount: formatSymptomCount(symptomsWithin72HoursPills),
        summaryPills: symptomsWithin72HoursPills,
      };
    }

    if (group.title === "Persisting, Worsening, or Newly Emerged Symptoms") {
      return {
        ...group,
        highlightedPillSet: persistingSymptomsHighlightedSet,
        summaryCount: formatSymptomCount(persistingSymptomsPills),
        summaryPills: persistingSymptomsPills,
      };
    }

    return group;
  });

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={{ ...cardStyle, padding: "14px 16px", marginBottom: "14px", background: "#0f1a2d" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#f8fbff", fontWeight: 800, fontSize: "0.95rem" }}>{resolvedReportData.reportTitle}</div>
              <div style={{ ...mutedTextStyle, fontSize: "0.78rem", marginTop: "5px" }}>{reportHeaderDescription}</div>
            </div>
            <StatusBadge>{approvalBadgeText}</StatusBadge>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "16px", marginBottom: "14px" }}>
          <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.02rem" }}>{resolvedReportData.patient.heading}</div>
          <div style={{ ...mutedTextStyle, fontSize: "0.78rem", marginTop: "5px" }}>Patient information</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "14px" }}>
            {resolvedReportData.patient.fields.map((field) => (
              <div key={field.label} style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px 13px" }}>
                <div style={{ ...mutedTextStyle, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{field.label}</div>
                <div style={{ color: "#f8fbff", fontWeight: 700, marginTop: "8px", minHeight: "20px" }}>{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: "14px" }}>
          <SectionTitle
            title="Summary of Consciousness and Cognitive Disruption"
            subtitle="Based on screening responses, the patient's reported and observed behavior reflects the following"
            gradient="linear-gradient(90deg, #8b5cf6 0%, #4f46e5 100%)"
          />
          <div style={{ padding: "14px" }}>
            {visibleConcerns.map((concern) => (
              <div
                key={concern.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto",
                  gap: "10px",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "rgba(127, 29, 29, 0.18)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: "10px",
                  marginBottom: "10px",
                }}
              >
                <FaCheckCircle style={{ color: "#86efac" }} />
                <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.85rem" }}>
                  {concern.label} - {concern.description}
                </div>
                <StatusBadge>{concern.level}</StatusBadge>
              </div>
            ))}

            <div
              style={{
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(239, 68, 68, 0.18) 100%)",
                border: "1px solid rgba(251, 191, 36, 0.26)",
                borderRadius: "12px",
                padding: "16px 18px",
                marginTop: "6px",
              }}
            >
              <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.14rem" }}>Overall Classification</div>
              <div
                style={{
                  marginTop: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "13px 18px",
                  borderRadius: "999px",
                  ...classificationPillStyle,
                  fontWeight: 800,
                  fontSize: "1.04rem",
                }}
              >
                {showClassificationAlertIcon ? (
                  <FaExclamationCircle style={{ color: classificationIconColor, fontSize: "1rem" }} />
                ) : null}
                <span>{`"${resolvedClassification}"`}</span>
              </div>
            </div>

            <div style={{ ...mutedTextStyle, fontSize: "0.96rem", lineHeight: 1.65, marginTop: "14px", maxWidth: "760px" }}>
              The follow counts represent the patient's self-reported symptoms burden across across three clinical timepoints - Before the injury, within 72 hours of the injury, and currently.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "12px",
                marginTop: "14px",
              }}
            >
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.34)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "12px",
                  padding: "16px 14px",
                  minHeight: "146px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div style={{ ...mutedTextStyle, fontWeight: 700, fontSize: "0.9rem" }}>PRE-INJURY BASELINE</div>
                <div style={{ color: "#ffffff", fontWeight: 900, fontSize: "2.2rem", lineHeight: 1 }}>{baselineCalcValue}</div>
                <div style={{ ...mutedTextStyle, fontSize: "0.8rem" }}>Symptoms before injury</div>
              </div>
              <div
                style={{
                  background: highlightAcuteSummaryCard
                    ? "linear-gradient(180deg, rgba(120, 53, 15, 0.34) 0%, rgba(15, 23, 42, 0.5) 100%)"
                    : "rgba(15, 23, 42, 0.34)",
                  border: highlightAcuteSummaryCard
                    ? "1px solid rgba(251, 191, 36, 0.55)"
                    : "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "12px",
                  padding: "16px 14px",
                  minHeight: "146px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "center",
                  boxShadow: highlightAcuteSummaryCard ? "0 0 0 1px rgba(245, 158, 11, 0.18), 0 12px 24px rgba(245, 158, 11, 0.12)" : "none",
                }}
              >
                <div style={{ ...(highlightAcuteSummaryCard ? { color: "#fde68a" } : mutedTextStyle), fontWeight: 700, fontSize: "0.9rem" }}>ACUTE (WITHIN 72 HOURS)</div>
                <div style={{ color: highlightAcuteSummaryCard ? "#fef3c7" : "#ffffff", fontWeight: 900, fontSize: "2.2rem", lineHeight: 1 }}>{acuteCalcValue}</div>
                <div style={{ ...(highlightAcuteSummaryCard ? { color: "#fcd34d" } : mutedTextStyle), fontSize: "0.8rem" }}>{`+${acuteNewOptionTally} new after injury`}</div>
              </div>
              <div
                style={{
                  background: highlightCurrentSummaryCard
                    ? "linear-gradient(180deg, rgba(127, 29, 29, 0.3) 0%, rgba(15, 23, 42, 0.5) 100%)"
                    : "rgba(15, 23, 42, 0.34)",
                  border: highlightCurrentSummaryCard
                    ? "1px solid rgba(248, 113, 113, 0.5)"
                    : "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "12px",
                  padding: "16px 14px",
                  minHeight: "146px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "center",
                  boxShadow: highlightCurrentSummaryCard ? "0 0 0 1px rgba(248, 113, 113, 0.16), 0 12px 24px rgba(239, 68, 68, 0.12)" : "none",
                }}
              >
                <div style={{ ...(highlightCurrentSummaryCard ? { color: "#fecaca" } : mutedTextStyle), fontWeight: 700, fontSize: "0.9rem" }}>CURRENT / ONGOING</div>
                <div style={{ color: highlightCurrentSummaryCard ? "#fee2e2" : "#ffffff", fontWeight: 900, fontSize: "2.2rem", lineHeight: 1 }}>{currentCalcValue}</div>
                <div style={{ ...(highlightCurrentSummaryCard ? { color: "#fca5a5" } : mutedTextStyle), fontSize: "0.8rem" }}>
                  {`${currentCalcValue} ${currentCalcValue === 1 ? "Symptom progressing" : "Symptoms progressing"}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: "14px" }}>
          <SectionTitle
            title="Understanding TBI Indicators"
            subtitle="Clinical criteria for assessing consciousness and cognitive disruption"
            gradient="linear-gradient(90deg, #0f172a 0%, #1e293b 100%)"
            centered
            largeTitle
            titleSize="1.65rem"
          />
          <div style={{ padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "#cbd5e1", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em" }}>
              <FaBook style={{ color: "#cbd5e1", fontSize: "0.82rem" }} />
              <span>CLINICAL DEFINITIONS - PER ACRM GUIDELEINES</span>
            </div>
            <div style={{ ...mutedTextStyle, fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "14px" }}>
              The following indicators are evaluated using criterion established by the American Congress of Rehabilitation Medicine (ACRM) for the classification of Traumatic Brain Injury. Each criterion reflects a specific disruption to neurological function at the time of injury.
            </div>
            {visibleIndicators.map((indicator) => (
              <div key={indicator.title} style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px", marginBottom: "10px" }}>
                <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.85rem" }}>{indicator.title}</div>
                <div style={{ ...mutedTextStyle, fontSize: "0.81rem", lineHeight: 1.6, marginTop: "6px" }}>{indicator.body}</div>
              </div>
            ))}
            {visibleConcernLabels.has("LOC") ? (
              <>
                <div style={{ marginTop: "4px", color: "#cbd5e1", fontSize: "0.76rem", fontWeight: 700, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                  <div>LOSS OF CONSCIOUSNESS</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "10px", marginBottom: "10px" }}>
                  {showSelfReportedLocPrimaryCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>SELF-REPORTED LOSS OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>
                        The patient provided strong self-report indicators consistent with a loss of consciousness.
                      </div>
                    </div>
                  ) : null}
                  {showSelfReportedLocSecondaryCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>SELF-REPORTED LOSS OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>{selfReportedLocSecondaryDescription}</div>
                    </div>
                  ) : null}
                  {showWitnessedLocCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>WITNESSED LOSS OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>{witnessedLocDescription}</div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {visibleConcernLabels.has("AOC") ? (
              <>
                <div style={{ color: "#cbd5e1", fontSize: "0.76rem", fontWeight: 700, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                  <div>ALTERATION OF CONSCIOUSNESS</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "10px", marginBottom: "10px" }}>
                  {showSelfReportedAocPrimaryCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>SELF-REPORTED ALTERATION OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>
                        The patient provided strong self-report indicators consistent with a loss of consciousness.
                      </div>
                    </div>
                  ) : null}
                  {showSelfReportedAocSecondaryCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>SELF-REPORTED ALTERATION OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>{selfReportedAocSecondaryDescription}</div>
                    </div>
                  ) : null}
                  {showWitnessedAocCard ? (
                    <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                      <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>WITNESSED ALTERATION OF CONSCIOUSNESS</div>
                      <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>{witnessedAocDescription}</div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {visibleConcernLabels.has("PTA") ? (
              <>
                <div style={{ color: "#cbd5e1", fontSize: "0.76rem", fontWeight: 700, lineHeight: 1.7, letterSpacing: "0.04em" }}>
                  <div>POS-TRAMATIC AMNESIA / MEMORY</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "10px" }}>
                  <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>SELF-REPORTED MEMORY LOSS</div>
                    <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>
                      The patient reported substantial memory loss, including inability to recall key parts of the incident, persistent memory disruption, or retrograde amnesia. These findings are consistent with traumatic brain injury.
                    </div>
                  </div>
                  <div style={{ background: "#121c2e", border: "1px solid #24324e", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.68rem", marginBottom: "6px" }}>WITNESSED MEMORY LOSS</div>
                    <div style={{ ...mutedTextStyle, fontSize: "0.68rem", lineHeight: 1.5 }}>
                      According to the patient witnesses did not report or relate to them issues with memory at or near the time of accident.
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: "14px" }}>
          <SectionTitle
            title="Symptom Presentation Timeline"
            subtitle="Placeholder symptom chronology matching the PDF's three-band presentation"
            gradient="linear-gradient(90deg, #14b8a6 0%, #2563eb 100%)"
          />
          <div style={{ padding: "14px", display: "grid", gap: "12px" }}>
            {resolvedTimelineGroups.map((group) => (
              <TimelineGroup key={group.title} group={group} />
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: "14px" }}>
          <SectionTitle
            title="Summary of Assessment"
            gradient="linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)"
          />
          <div style={{ padding: "14px" }}>
            <div style={{ ...mutedTextStyle, fontSize: "0.98rem", lineHeight: 1.75 }}>{reportData.summary}</div>
          </div>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden", marginBottom: "14px" }}>
          <SectionTitle
            title="TBI Treatment Plan Outline"
            gradient="linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)"
            subtitleNode={
              <span>
                Based on <strong>{`"${resolvedClassification}"`}</strong> classification with <span style={{ color: "#ffffff" }}>{resolvedSymptomProgressionScore} {resolvedSymptomProgressionScore === 1 ? "symptom" : "symptoms"} progressing</span>
              </span>
            }
            badge={{
              label: "Clinical Protocol",
              background: "rgba(250, 204, 21, 0.32)",
              border: "1px solid rgba(250, 204, 21, 0.48)",
              color: "#fef3c7",
            }}
          />
          <div style={{ padding: "14px" }}>
            <div style={{ ...cardStyle, background: "#111a2b", padding: "12px 14px", marginBottom: "14px", borderLeft: "4px solid #facc15" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <FaLightbulb style={{ color: "#facc15" }} />
                <div style={{ color: "#f8fbff", fontWeight: 700, fontSize: "0.86rem" }}>Important</div>
              </div>
              <div style={{ ...mutedTextStyle, fontSize: "0.82rem", lineHeight: 1.6, marginTop: "7px" }}>
                The following recommendations are based on the patient's screening profile and are intended to guide clinical decision-making. All interventions should be reviewed and ordered by a qualified treating provider. Given the Likely TBI classification and ongoing symptom burden, prompt initiation of multidisciplinary care is strongly advised.
              </div>
            </div>

            {reportData.outline.map((item) => (
              <OutlineStep key={item.step} item={item} />
            ))}

            <div style={{ ...cardStyle, background: "#111a2b", padding: "14px", marginTop: "16px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#f8fbff", fontWeight: 700 }}>
                <FaShieldAlt style={{ color: "#60a5fa" }} />
                Immediate Action Recommended
              </div>
              <div style={{ ...mutedTextStyle, fontSize: "0.82rem", lineHeight: 1.65, marginTop: "8px" }}>
                Research data is unambiguous: <strong style={{ color: "#ffffff" }}>early intervention following TBI leads to the best patient outcomes.</strong> Neuroplasticity — the brain's capacity for repair and reorganization — is most active in the acute and subacute phases following injury. Delays in diagnosis and treatment allow secondary injury cascades to progress and reduce the window for maximum recovery. We strongly recommend immediate action toward all steps outlined in this plan. The Valhalla Health clinical team is available to support coordination of care, provider referrals, and clinical consultation throughout this process.
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: "14px 16px", background: "#0f1a2d" }}>
          <div>
            <div>
              <div style={{ color: "#f8fbff", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em" }}>{reportData.footer.title}</div>
              <div style={{ ...mutedTextStyle, fontSize: "0.8rem", lineHeight: 1.65, marginTop: "8px" }}>{reportData.footer.body}</div>
              <div style={{ color: "#dbeafe", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em", marginTop: "10px", textAlign: "center" }}>
                {reportData.footer.signature}
              </div>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "10px", color: "#cdd7ea", fontSize: "0.78rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><FaCalendarAlt /> 04/23/2026</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><FaPhoneAlt /> Valhalla clinical sample</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><FaMapMarkerAlt /> Redacted preview only</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
