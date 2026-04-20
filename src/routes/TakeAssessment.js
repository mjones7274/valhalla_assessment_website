import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequestPublic } from "../api";
import RunAssessment from "./RunAssessment";
import "./RunAssessment.css";
import { getSelectedCompany } from "../auth";

const PERF_DEBUG = process.env.REACT_APP_PERF_DEBUG === "1";

const DEFAULT_BRAND_LOGO_URL =
  "https://valhallaplus.org/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fvalhalla-icon.c13cd40e.png&w=64&q=75";

const getQuestionOrderValue = (questionSection) => {
  const rawOrder =
    questionSection?.question_order ??
    questionSection?.order ??
    questionSection?.question_section_order ??
    null;

  const parsed = Number(rawOrder);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const compareQuestionOrder = (left, right) => {
  const leftOrder = getQuestionOrderValue(left);
  const rightOrder = getQuestionOrderValue(right);

  if (leftOrder === null && rightOrder === null) return 0;
  if (leftOrder === null) return 1;
  if (rightOrder === null) return -1;
  return leftOrder - rightOrder;
};

const normalizeAttempt = (payload) => payload?.patient_assessment_attempt ?? payload?.attempt ?? payload;

const getAttemptIdValue = (attempt) =>
  Number(
    attempt?.id ??
    attempt?.assessment_attempt_id ??
    attempt?.patient_assessment_attempt_id ??
    attempt?.attempt_id ??
    0
  ) || 0;

const InfoDialog = ({ title, message, onClose }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1800,
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
      <h3 style={{ marginBottom: "12px", color: "#dc3545" }}>{title}</h3>
      <p style={{ marginBottom: "20px", color: "#444" }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose}>OK</button>
      </div>
    </div>
  </div>
);

const SessionExpiredDialog = ({ onOk }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
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
      <p style={{ marginBottom: "20px", color: "#444", lineHeight: 1.4 }}>
        Your session has expired due to no activity.  Use the original link to continue where you left off, or refresh this page
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onOk}>OK</button>
      </div>
    </div>
  </div>
);

export default function TakeAssessment() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [assessmentDetails, setAssessmentDetails] = useState(null);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showSubmittedDialog, setShowSubmittedDialog] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRunAssessmentOpen, setIsRunAssessmentOpen] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isSessionExpiredAcknowledged, setIsSessionExpiredAcknowledged] = useState(false);
  const inactivityTimeoutRef = useRef(null);
  const inactivityLastResetRef = useRef(0);

  useEffect(() => {
    if (isSessionExpired || isSessionExpiredAcknowledged) {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      return;
    }

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

    const resetTimer = () => {
      const now = Date.now();
      if (now - inactivityLastResetRef.current < 750) return;
      inactivityLastResetRef.current = now;

      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }

      inactivityTimeoutRef.current = setTimeout(() => {
        setIsSessionExpired(true);
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "pointerdown",
    ];

    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    };
  }, [isSessionExpired, isSessionExpiredAcknowledged]);

  useEffect(() => {
    let cancelled = false;

    const fetchJson = async (path) => {
      const res = await apiRequestPublic(path);
      if (!res.ok) {
        const message = await res.text().catch(() => "");
        const err = new Error(`Request failed (${res.status}) ${message}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    };

    const load = async () => {
      const loadStartedAt = Date.now();
      const perfMarks = {};
      const mark = (label) => {
        perfMarks[label] = Date.now();
      };
      const logPerfSummary = (statusLabel) => {
        if (!PERF_DEBUG) return;

        const tokenFetchMs = (perfMarks.tokenFetchedAt ?? Date.now()) - (perfMarks.tokenFetchStartedAt ?? loadStartedAt);
        const detailsFetchMs =
          perfMarks.detailsFetchedAt && perfMarks.detailsFetchStartedAt
            ? perfMarks.detailsFetchedAt - perfMarks.detailsFetchStartedAt
            : 0;
        const totalMs = Date.now() - loadStartedAt;

        console.info("[TakeAssessment Perf]", {
          token: statusLabel,
          tokenFetchMs,
          detailsFetchMs,
          totalMs,
        });
      };

      if (!token) {
        setError("Missing assessment token.");
        setLoading(false);
        logPerfSummary("missing-token");
        return;
      }

      setLoading(true);
      setError(null);
      setShowBlockedDialog(false);
      setShowSubmittedDialog(false);
      setHasStarted(false);
      setIsStarting(false);
      setIsRunAssessmentOpen(true);

      try {
        mark("tokenFetchStartedAt");
        const encodedToken = encodeURIComponent(token);
        let tokenPayload = null;
        try {
          tokenPayload = await fetchJson(`/assessment/${encodedToken}/`);
        } catch (withSlashError) {
          const slashStatus = withSlashError?.status;
          if (slashStatus === 404) {
            tokenPayload = await fetchJson(`/assessment/${encodedToken}`);
          } else {
            throw withSlashError;
          }
        }
        mark("tokenFetchedAt");

        const attemptData = normalizeAttempt(tokenPayload);
        const status = String(attemptData?.status ?? "").toLowerCase();

        if (!cancelled) {
          setAttempt(attemptData ?? null);
        }

        if (status === "completed" || status === "removed") {
          if (!cancelled) {
            setShowBlockedDialog(true);
            setAssessmentDetails(null);
            setLoading(false);
          }
          return;
        }

        if (!['assigned', 'in_progress'].includes(status)) {
          if (!cancelled) {
            setError(`Unsupported assessment status: ${status || "(missing)"}`);
            setLoading(false);
          }
          return;
        }

        const assessmentId = Number(attemptData?.assessment?.assessment_id ?? 0);
        if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
          throw new Error("Unable to resolve assessment id from token response.");
        }

        let details;
        mark("detailsFetchStartedAt");
        try {
          details = await fetchJson(`/api/assessments-detail/${assessmentId}/`);
        } catch {
          details = await fetchJson(`/api/assessments/${assessmentId}/`);
        }
        mark("detailsFetchedAt");
        if (!cancelled) {
          setAssessmentDetails(details);
          setLoading(false);
        }
        logPerfSummary("loaded");
      } catch (err) {
        console.error("[TakeAssessment] load failed", err);
        if (!cancelled) {
          setError(String(err?.message ?? err));
          setLoading(false);
        }
        logPerfSummary("failed");
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const groupedSections = useMemo(() => {
    const sections = assessmentDetails?.sections ?? [];
    return sections
      .slice()
      .sort((a, b) => Number(a.section_order ?? 0) - Number(b.section_order ?? 0))
      .map(({ assessment_section_id, section_order, section }) => ({
        assessment_section_id,
        section_id: section?.section_id,
        sectionOrder: section_order,
        title: section?.title,
        description: section?.description,
        instructions: section?.instructions,
        questions: [...(section?.questions || [])].sort(compareQuestionOrder),
      }));
  }, [assessmentDetails]);

  const selectedCompany = getSelectedCompany();
  const companyFromAttempt =
    attempt?.patient?.companies?.[0]?.company ??
    attempt?.patient?.companies?.[0] ??
    null;

  const companyName =
    selectedCompany?.company_name ??
    selectedCompany?.name ??
    companyFromAttempt?.company_name ??
    companyFromAttempt?.name ??
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

  const patientId = Number(
    attempt?.patient?.patient_id ??
    attempt?.patient_id ??
    attempt?.patient ??
    0
  ) || null;
  const patientEventId = Number(
    attempt?.patient_event?.patient_event_id ??
    attempt?.patient_event_id ??
    attempt?.patient_event ??
    0
  ) || null;
  const assessmentId = Number(
    attempt?.assessment?.assessment_id ??
    attempt?.assessment_id ??
    attempt?.assessment ??
    0
  ) || null;
  const attemptIdOverride = getAttemptIdValue(attempt) || null;

  const attemptStatus = String(attempt?.status ?? "").toLowerCase();
  const shouldShowWelcome = attemptStatus === "assigned" && !hasStarted;

  const startAssessment = async () => {
    if (isStarting) return;

    const resolvedAttemptId = Number(attemptIdOverride);
    if (!Number.isFinite(resolvedAttemptId) || resolvedAttemptId <= 0) {
      setError("Unable to start assessment: missing attempt id.");
      return;
    }

    const firstSection = groupedSections[0] ?? null;
    const firstQuestionSection = firstSection?.questions?.[0] ?? null;
    const firstQuestionId =
      Number(
        firstQuestionSection?.question?.question_id ??
          firstQuestionSection?.question_id ??
          firstQuestionSection?.questionSectionId ??
          0
      ) || null;
    const firstSectionId = Number(firstSection?.assessment_section_id ?? 0) || null;

    setIsStarting(true);
    setError(null);

    try {
      const patchRes = await apiRequestPublic(`/api/patient-assessment-attempts/${resolvedAttemptId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
          current_question_id: firstQuestionId,
          current_section_id: firstSectionId,
          ...(Number.isFinite(Number(patientEventId)) && Number(patientEventId) > 0
            ? { patient_event_id: Number(patientEventId) }
            : {}),
        }),
      });

      if (!patchRes.ok) {
        const message = await patchRes.text().catch(() => "");
        throw new Error(`Unable to start assessment (${patchRes.status}) ${message}`);
      }

      const updatedAttempt = await patchRes.json().catch(() => null);
      setAttempt((prev) => {
        const previousAttempt = prev ?? {};
        if (updatedAttempt && typeof updatedAttempt === "object") {
          return {
            ...previousAttempt,
            ...updatedAttempt,
            patient: previousAttempt.patient ?? updatedAttempt.patient,
            patient_event: previousAttempt.patient_event ?? updatedAttempt.patient_event,
            assessment: previousAttempt.assessment ?? updatedAttempt.assessment,
          };
        }
        return { ...previousAttempt, status: "in_progress" };
      });
      setHasStarted(true);
    } catch (err) {
      console.error("[TakeAssessment] start failed", err);
      setError(String(err?.message ?? err));
    } finally {
      setIsStarting(false);
    }
  };

  const renderBackgroundOnly = (children) => (
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
      {children}
    </div>
  );

  if (isSessionExpiredAcknowledged) {
    return <div style={{ background: "#fff", height: "100vh", width: "100vw" }} />;
  }

  if (isSessionExpired) {
    return (
      <SessionExpiredDialog
        onOk={() => {
          setIsSessionExpiredAcknowledged(true);
        }}
      />
    );
  }

  if (loading) {
    return renderBackgroundOnly(
      <div className="run-assessment-modal">
        <div className="run-assessment-frame">
          <div className="run-assessment-shell run-assessment-shell-static">
            <div className="run-assessment-empty">Loading assessment...</div>
          </div>
        </div>
      </div>
    );
  }

  if (showBlockedDialog) {
    return renderBackgroundOnly(
      <InfoDialog
        title="Assessment Unavailable"
        message="This Assessment has been completed or removed"
        onClose={() => setShowBlockedDialog(false)}
      />
    );
  }

  if (showSubmittedDialog) {
    return renderBackgroundOnly(
      <InfoDialog
        title="Assessment Submitted"
        message="You can close this window."
        onClose={() => setShowSubmittedDialog(false)}
      />
    );
  }

  if (error) {
    return renderBackgroundOnly(
      <InfoDialog
        title="Unable to Load Assessment"
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

  if (shouldShowWelcome) {
    const patientFirstName =
      attempt?.patient?.person?.first_name ||
      attempt?.patient?.first_name ||
      attempt?.patient_first_name ||
      "";

    const applyPatientFirstNamePlaceholder = (value) => {
      try {
        if (typeof value !== "string") return value;
        const replacement = patientFirstName ? String(patientFirstName) : "";
        return value.split("<patient_first_name>").join(replacement);
      } catch {
        if (typeof value !== "string") return value;
        return value.split("<patient_first_name>").join("");
      }
    };

    const welcomeTitle = applyPatientFirstNamePlaceholder(
      assessmentDetails?.patient_title ||
        assessmentDetails?.name ||
        attempt?.assessment?.patient_title ||
        attempt?.assessment?.name ||
        "Assessment"
    );

    const welcomeInstructionsRaw =
      assessmentDetails?.patient_instructions ||
      assessmentDetails?.instructions ||
      attempt?.assessment?.patient_instructions ||
      attempt?.assessment?.instructions ||
      "";

    const welcomeInstructions = applyPatientFirstNamePlaceholder(welcomeInstructionsRaw);

    return renderBackgroundOnly(
      <div className="run-assessment-modal">
        <div className="run-assessment-frame">
          <div className="run-assessment-shell run-assessment-shell-static">
            <div
              className="run-assessment-card"
              style={{
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div style={{ width: "min(720px, 100%)" }}>
                <div
                  className="run-assessment-welcome-title"
                  style={{
                    fontWeight: 800,
                    marginBottom: "14px",
                  }}
                >
                  {welcomeTitle}
                </div>

                {welcomeInstructions ? (
                  <div
                    className="run-assessment-welcome-instructions"
                    style={{
                      fontWeight: 400,
                      whiteSpace: "pre-wrap",
                      marginBottom: "22px",
                    }}
                  >
                    {welcomeInstructions}
                  </div>
                ) : (
                  <div style={{ marginBottom: "22px" }} />
                )}

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="run-assessment-link run-assessment-link-next run-assessment-link-primary"
                    onClick={startAssessment}
                    disabled={isStarting}
                    style={{ flex: "unset", width: "min(340px, 100%)" }}
                  >
                    <span>{isStarting ? "Starting..." : "Start Assessment"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RunAssessment
      isOpen={isRunAssessmentOpen}
      onClose={() => {}}
      onSubmitComplete={() => {
        setIsRunAssessmentOpen(false);
        setShowSubmittedDialog(true);
      }}
      shouldPersistAssessmentResponses={true}
      showMetadataToggle={false}
      assessmentName={
        assessmentDetails?.patient_title ||
        assessmentDetails?.name ||
        attempt?.assessment?.patient_title ||
        attempt?.assessment?.name ||
        "Assessment"
      }
      assessmentId={assessmentId}
      patientId={patientId}
      patientEventId={patientEventId}
      attemptIdOverride={attemptIdOverride}
      prefillData={{
        dob: attempt?.patient?.dob ?? attempt?.patient_dob ?? null,
        event_date:
          attempt?.patient_event?.event_date ??
          attempt?.patient_event_date ??
          null,
        referral_company_name:
          companyFromAttempt?.company_name ??
          companyFromAttempt?.name ??
          null,
      }}
      requestFn={apiRequestPublic}
      sections={groupedSections}
    />
  );
}
