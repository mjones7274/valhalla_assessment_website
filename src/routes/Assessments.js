import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";
import "./Assessments.css";

const ASSESSMENTS_API = `${process.env.REACT_APP_API_URL_BASE}/api/assessments/`;

function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [search, setSearch] = useState("");
  const [showInactiveAssessments, setShowInactiveAssessments] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cloningAssessmentId, setCloningAssessmentId] = useState(null);
  const navigate = useNavigate();

  const loadAssessments = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiRequest(ASSESSMENTS_API);
      const data = await response.json();
      setAssessments(data);
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // const assessmentType = sessionStorage.getItem("assessment_type");

    // Redirect to Home if not logged in
    // if (!assessmentType) {
    //   navigate("/");
    //   return;
    // }

    loadAssessments();
  }, [loadAssessments, navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  const getAssessmentIsActive = (assessment) => {
    const rawValue =
      assessment?.is_active ??
      assessment?.assessment?.is_active ??
      assessment?.active;

    if (typeof rawValue === "boolean") return rawValue;
    if (typeof rawValue === "number") return rawValue === 1;
    if (typeof rawValue === "string") {
      const normalized = rawValue.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }

    return true;
  };

  const filteredAssessments = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const searchFilteredList = !searchText
      ? assessments
      : assessments.filter((assessment) => {
      return (
        String(assessment.assessment_id ?? "").toLowerCase().includes(searchText) ||
        String(assessment.name ?? "").toLowerCase().includes(searchText) ||
        String(assessment.description ?? "").toLowerCase().includes(searchText) ||
        String(assessment.first_name ?? "").toLowerCase().includes(searchText) ||
        String(assessment.last_name ?? "").toLowerCase().includes(searchText) ||
        String(assessment.question_count ?? "").toLowerCase().includes(searchText) ||
        String(assessment.created_on ?? "").toLowerCase().includes(searchText)
      );
    });

    const statusFilteredList = showInactiveAssessments
      ? searchFilteredList
      : searchFilteredList.filter((assessment) => getAssessmentIsActive(assessment));

    return [...statusFilteredList].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
        sensitivity: "base",
      })
    );
  }, [assessments, search, showInactiveAssessments]);

  const handleCreatedAssessment = (newAssessment) => {
    setAssessments((prev) => [newAssessment, ...prev]);
    setShowCreateModal(false);
  };

  const handleCloneAssessment = async (assessmentId) => {
    if (!assessmentId || cloningAssessmentId !== null) return;

    setCloningAssessmentId(assessmentId);

    try {
      const response = await apiRequest(`${ASSESSMENTS_API}${assessmentId}/clone/`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Clone assessment failed with status ${response.status}`);
      }

      await loadAssessments();
    } catch (error) {
      console.error("Clone assessment failed", error);
    } finally {
      setCloningAssessmentId(null);
    }
  };

  return (
    <div className="assessments-page">
      <div className="assessments-wrapper">
        <header className="assessments-header-row portal-page-header">
          <div>
            <p className="portal-page-kicker">Clinical library</p>
            <h1 className="assessments-title portal-page-title">
              Assessments
              <span className="portal-page-count">{filteredAssessments.length}</span>
            </h1>
            <p className="portal-page-subtitle">Build and manage the assessments used across patient care.</p>
          </div>
          <div className="portal-page-actions">
            <button
              className="assessments-action-btn assessments-action-btn-secondary"
              onClick={() => navigate("/question-types")}
            >
              Question Types
            </button>
            <button
              className="assessments-action-btn portal-primary-action"
              onClick={() => setShowCreateModal(true)}
            >
              + Add New Assessment
            </button>
          </div>
        </header>

        <div className="assessments-toolbar portal-command-bar">
          <label className="portal-search-field" htmlFor="assessments-search">
            <span>Search</span>
            <input
              id="assessments-search"
              className="assessments-search portal-search-input"
              placeholder="Search assessments..."
              aria-label="Search assessments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="assessments-filters">
            <label className="assessments-checkbox-label">
              <input
                type="checkbox"
                checked={showInactiveAssessments}
                onChange={(e) => setShowInactiveAssessments(e.target.checked)}
              />
              Show Inactive Assessments
            </label>
          </div>
        </div>

        {loading ? (
          <div className="assessments-grid assessments-skeleton-grid" aria-live="polite" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((slot) => (
              <div className="assessment-card assessment-card-skeleton" key={`assessment-page-skeleton-${slot}`}>
                <div className="assessment-skeleton-line assessment-skeleton-heading" />
                <div className="assessment-skeleton-line assessment-skeleton-title" />
                <div className="assessment-skeleton-line assessment-skeleton-text" />
                <div className="assessment-skeleton-line assessment-skeleton-text short" />
                <div className="assessment-skeleton-line assessment-skeleton-text" />
                <div className="assessment-skeleton-line assessment-skeleton-status" />
                <div className="assessment-skeleton-line assessment-skeleton-button" />
              </div>
            ))}
          </div>
        ) : filteredAssessments.length === 0 ? (
          <p className="portal-empty-state">No assessments found.</p>
        ) : (
          <div className="assessments-grid">
            {filteredAssessments.map((assessment, index) => (
              <div
                key={assessment.assessment_id ?? assessment.customer_id ?? `assessment-${index}`}
                className="assessment-card"
              >
                {(() => {
                  const isActive = getAssessmentIsActive(assessment);
                  return (
                    <>
                <div className="assessment-card-topline">
                  <span className="assessment-card-index">
                    Assessment {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`assessment-status-pill ${isActive ? "active" : "inactive"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <h3 className="assessment-name">{assessment.name}</h3>
                <p className="assessment-description">
                  {assessment.description || "No description provided."}
                </p>

                <div className="assessment-card-meta">
                  <div>
                    <span>Owner</span>
                    <strong>
                      {[assessment.first_name, assessment.last_name].filter(Boolean).join(" ") || "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDate(assessment.created_on)}</strong>
                  </div>
                  <div>
                    <span>Questions</span>
                    <strong>{assessment.question_count ?? 0}</strong>
                  </div>
                </div>

                <div className="assessment-card-actions">
                    <button
                      className="clone-btn"
                      onClick={() => handleCloneAssessment(assessment.assessment_id)}
                      disabled={cloningAssessmentId === assessment.assessment_id}
                    >
                      {cloningAssessmentId === assessment.assessment_id
                        ? "Cloning assessment..."
                        : "Clone this assessment"}
                    </button>
                    <button
                      className="details-btn"
                      onClick={() => navigate(`/assessment-details/${assessment.assessment_id}`)}
                    >
                      Show Details
                    </button>
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <CreateAssessmentModal
            onCancel={() => setShowCreateModal(false)}
            onCreated={handleCreatedAssessment}
          />
        )}
      </div>
    </div>
  );
}

const CreateAssessmentModal = ({ onCancel, onCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [patientInstructions, setPatientInstructions] = useState("");
  const [patientTitle, setPatientTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const useClientTerminology = shouldUseClientTerminology();

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        name,
        description,
        patient_instructions: patientInstructions,
        patient_title: patientTitle,
      };

      const response = await apiRequest(ASSESSMENTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Create assessment failed with status ${response.status}`);
      }

      const createdAssessment = await response.json();
      onCreated(createdAssessment);
    } catch (err) {
      console.error("Create assessment failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern assessment-create-modal">
        <div className="modal-header">
          <h3>Add New Assessment</h3>
          <button className="icon-close" onClick={onCancel}>✕</button>
        </div>

        <div className="details-grid">
          <div className="detail-row">
            <div className="detail-label">Name</div>
            <div className="detail-value">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="detail-row">
            <div className="detail-label">Description</div>
            <div className="detail-value">
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="detail-row">
            <div className="detail-label">
              {replacePatientText("Patient Instructions", useClientTerminology)}
            </div>
            <div className="detail-value">
              <input
                value={patientInstructions}
                onChange={(e) => setPatientInstructions(e.target.value)}
              />
            </div>
          </div>

          <div className="detail-row">
            <div className="detail-label">
              {replacePatientText("Patient Title", useClientTerminology)}
            </div>
            <div className="detail-value">
              <input value={patientTitle} onChange={(e) => setPatientTitle(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assessments;
