import React, { useEffect, useMemo, useState } from "react";
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
  const navigate = useNavigate();

  useEffect(() => {
    // const assessmentType = sessionStorage.getItem("assessment_type");

    // Redirect to Home if not logged in
    // if (!assessmentType) {
    //   navigate("/");
    //   return;
    // }

    apiRequest(ASSESSMENTS_API)
      .then((res) => res.json())
      .then((data) => {
        setAssessments(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching assessments:", err);
        setLoading(false);
      });
  }, [navigate]);

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

  return (
    <div className="assessments-page">
      <div className="assessments-wrapper">
        <h2 className="assessments-title">Assessments</h2>

        <div className="assessments-toolbar">
          <input
            className="assessments-search"
            placeholder="Search assessments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="assessments-actions">
          <button
            className="assessments-action-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Add New Assessment
          </button>
        </div>

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

        {loading ? (
          <p>Loading assessments...</p>
        ) : filteredAssessments.length === 0 ? (
          <p>No assessments found.</p>
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
                <h3>
                  {assessment.first_name} {assessment.last_name}
                </h3>
                <p>
                  <strong className="assessment-name">{assessment.name}</strong>
                </p>
                <p>
                  <strong className="assessment-card-label">Description:</strong> {assessment.description}
                </p>
                <p>
                  <strong className="assessment-card-label">Created On:</strong> {formatDate(assessment.created_on)}
                </p>
                <p>
                  <strong className="assessment-card-label">Total Questions:</strong> {assessment.question_count}
                </p>
                {/* <p>
                  <strong>Total Taken:</strong> {formatDate(assessment.last_login)}
                </p> */}
                <p>
                  <strong className="assessment-card-label">Status:</strong>{" "}
                  <span className={`assessment-status-pill ${isActive ? "active" : "inactive"}`}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </p>

                {/* Reset Password Button (UI only) */}
                <button
                  className="details-btn"
                  onClick={() => navigate(`/assessment-details/${assessment.assessment_id}`)}
                >
                  Show Details</button>
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
