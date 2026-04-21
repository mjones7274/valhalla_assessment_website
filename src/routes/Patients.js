import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FaSyncAlt, FaTrash } from "react-icons/fa";
import { apiRequest } from "../api";
import { getSelectedCompany } from "../auth";
import { getPatientLabels, shouldUseClientTerminology } from "../uiTerminology";
import "./Patients.css";

const API_BASE = process.env.REACT_APP_API_URL_BASE;
const PATIENTS_API_URL = `${API_BASE}/api/patients/`;
const PATIENTS_VIEW_API_URL = `${API_BASE}/api/patients-view/`;
const COMPANIES_API = `${API_BASE}/api/companies/`;
const PATIENT_TYPES_API = `${API_BASE}/api/patient-types/`;
const COMPANY_PATIENTS_API = `${API_BASE}/api/company-patients/`;
const COMPANY_PEOPLE_API = `${API_BASE}/api/company-people/`;
const PATIENT_PEOPLE_API = `${API_BASE}/api/patient-people/`;
const PATIENT_PHONES_API = `${API_BASE}/api/patient-phones/`;
const PATIENT_ADDRESSES_API = `${API_BASE}/api/patient-addresses/`;
const PATIENT_EVENTS_API = `${API_BASE}/api/patient-events/`;
const INJURY_EVENT_TYPES_API = `${API_BASE}/api/injury-event-types/`;
const PATIENT_ASSESSMENT_ATTEMPTS_API = `${API_BASE}/api/patient-assessment-attempts/`;
const PATIENT_ATTEMPT_PROGRESS_API = `${API_BASE}/api/patient-attempt-progress/`;
const PATIENT_RESPONSES_API = `${API_BASE}/api/patient-responses/`;
const PATIENT_RESPONSES_HISTORY_API = `${API_BASE}/api/patient-responses-history/`;
const PATIENT_TOKENS_CREATE_API = `${API_BASE}/api/patient-tokens/create/`;
const TEST_SEND_EMAIL_API = `${API_BASE}/api/test/send-email`;
const TEST_SEND_EMAIL_API_ALT = `${API_BASE}/api/test/send-email/`;
const ASSESSMENTS_API = `${API_BASE}/api/assessments/`;
const QUESTIONS_API = `${API_BASE}/api/questions/`;
const PEOPLE_API = `${API_BASE}/api/people/`;
const PERSON_TYPES_API = `${API_BASE}/api/person-types/`;
const PHONE_TYPES_API = `${API_BASE}/api/phone-types/`;
const ADDRESS_TYPES_API = `${API_BASE}/api/address-types/`;

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

const COUNTRY_OPTIONS = ["United States", "Canada", "Mexico"];

const getPersonFromRelation = (item) => item.person ?? item.people ?? item.person_data ?? item;

const getPersonTypeDescription = (person) => (
  person?.person_type?.description ??
  person?.person_type_description ??
  person?.person_type_name ??
  "—"
);

const getPersonDisplayName = (person) => {
  const first = person?.first_name ?? "";
  const last = person?.last_name ?? "";
  return `${first} ${last}`.trim() || person?.email || "—";
};

const normalizePhoneDigits = (value) => String(value ?? "").replace(/\D/g, "");

const formatPhoneForInput = (value) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)} ${digits.slice(10)}`;
};

const getResponseErrorMessage = async (response) => {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    return JSON.stringify(data);
  } catch {
    return `status ${response.status}`;
  }
};

const getPhoneRowKey = (phone) =>
  phone?.patient_phone_id ??
  phone?.id ??
  phone?.phone_id ??
  null;

const getPersistedPhoneId = (phone) =>
  phone?.patient_phone_id ??
  phone?.id ??
  null;

const getAddressRowKey = (address) =>
  address?.patient_address_id ??
  address?.id ??
  null;

const getPersistedAddressId = (address) =>
  address?.patient_address_id ??
  address?.id ??
  null;

const getPhonePatientId = (phone) => Number(
  phone?.patient_id ??
  phone?.patient ??
  phone?.web_patient_id ??
  phone?.web_patient ??
  phone?.patient_data?.patient_id ??
  phone?.patient_obj?.patient_id ??
  0
);

const getAddressPatientId = (address) => Number(
  address?.patient_id ??
  address?.patient ??
  address?.web_patient_id ??
  address?.web_patient ??
  address?.patient_data?.patient_id ??
  address?.patient_obj?.patient_id ??
  0
);

const getPatientRelationCandidates = (patientId) => {
  const normalizedPatientId = Number(patientId ?? 0);
  if (normalizedPatientId <= 0) return [];

  return [
    { patient_id: normalizedPatientId },
    { patient: normalizedPatientId },
  ];
};

const getCompanyIdFromCompanyPerson = (cp) => Number(
  cp.company_id ?? cp.company?.company_id ?? cp.company?.id ?? 0
);

const getPersonIdFromCompanyPerson = (cp) => {
  const person = getPersonFromRelation(cp);
  return Number(cp.person_id ?? person?.person_id ?? person?.id ?? 0);
};

const getPatientIdFromPatientPerson = (pp) => Number(
  pp.patient_id ?? pp.patient?.patient_id ?? pp.patient?.id ?? 0
);

const getPersonIdFromPatientPerson = (pp) => {
  const person = getPersonFromRelation(pp);
  return Number(pp.person_id ?? person?.person_id ?? person?.id ?? 0);
};

const getPatientPersonId = (pp) => (
  pp.patient_person_id ??
  pp.patient_people_id ??
  pp.patient_person?.patient_person_id ??
  null
);

const getPatientEventId = (patientEvent) => (
  patientEvent.patient_event_id ??
  patientEvent.patient_events_id ??
  patientEvent.id ??
  null
);

const getPatientIdFromPatientEvent = (patientEvent) => Number(
  patientEvent.patient_id ??
  patientEvent.patient?.patient_id ??
  patientEvent.patient?.id ??
  0
);

const getInjuryEventTypeDescription = (eventItem) => (
  eventItem?.injury_event_type?.description ??
  eventItem?.injury_event_type_description ??
  "—"
);

const getInjuryEventTypeId = (eventItem) => (
  Number(
    eventItem?.injury_event_type?.injury_event_type_id ??
    eventItem?.injury_event_type_id ??
    0
  ) || ""
);

const getAttemptPatientId = (attempt) => Number(
  attempt.patient_id ?? attempt.patient?.patient_id ?? attempt.patient?.id ?? 0
);

const getAttemptAssessmentId = (attempt) => Number(
  attempt.assessment_id ?? attempt.assessment?.assessment_id ?? attempt.assessment?.id ?? 0
);

const getAttemptPatientEventId = (attempt) => Number(
  attempt.patient_event_id ??
  attempt.patient_event?.patient_event_id ??
  attempt.patient_event?.id ??
  0
);

const getAttemptId = (attempt) => (
  attempt.id ??
  attempt.patient_assessment_attempt_id ??
  attempt.patient_assessment_attempts_id ??
  attempt.patient_assessment_id ??
  attempt.patient_assessment_attempt?.patient_assessment_attempt_id ??
  attempt.assessment_attempt_id ??
  null
);

const getAttemptStatus = (attempt) =>
  attempt.status ?? attempt.attempt_status ?? "assigned";

const getAttemptFinalScore = (attempt) =>
  attempt.final_score ?? attempt.score ?? attempt.total_score ?? null;

const formatFinalScoreForDisplay = (score) => {
  if (score === null || score === undefined || score === "") return "—";

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return String(score);

  const roundedScore = Math.round(numericScore * 100) / 100;
  if (Number.isInteger(roundedScore)) {
    return String(roundedScore);
  }

  return roundedScore.toFixed(2);
};

const getAttemptProgressAttemptId = (progressItem) => Number(
  progressItem?.patient_assessment_attempt_id ??
  progressItem?.patient_assessment_attempt?.patient_assessment_attempt_id ??
  progressItem?.patient_assessment_attempt ??
  progressItem?.attempt_id ??
  progressItem?.id ??
  0
);

const normalizeApiRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
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

const getResponseAttemptId = (responseItem) => Number(
  responseItem?.attempt?.id ??
    responseItem?.attempt_id ??
    responseItem?.assessment_attempt_id ??
    responseItem?.patient_assessment_attempt_id ??
    responseItem?.patient_assessment_attempt ??
    responseItem?.attempt ??
    0
) || 0;

const getResponseQuestionId = (responseItem) => Number(
  responseItem?.question?.question_id ??
    responseItem?.question_id ??
    responseItem?.question ??
    0
) || 0;

const getQuestionTypeDescription = (question) =>
  String(
    question?.question_type?.description ??
      question?.question_type_description ??
      question?.question_type ??
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const formatAnswerKeyLabel = (key) =>
  String(key ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatAnswerValueForTable = (value) => {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    if (!value.length) return "—";

    const formattedItems = value
      .map((item) => formatAnswerValueForTable(item))
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .filter((item) => item && item !== "—");

    return formattedItems.length ? formattedItems : "—";
  }

  if (typeof value === "object") {
    const hasOption = Object.prototype.hasOwnProperty.call(value, "option");
    const hasValue = Object.prototype.hasOwnProperty.call(value, "value");

    if (hasOption || hasValue) {
      const optionText = formatAnswerValueForTable(value.option);
      const valueText = formatAnswerValueForTable(value.value);
      return optionText !== "—" ? optionText : valueText;
    }

    const formattedEntries = Object.entries(value)
      .map(([key, nestedValue]) => {
        const formattedValue = formatAnswerValueForTable(nestedValue);
        return formattedValue && formattedValue !== "—"
          ? `${formatAnswerKeyLabel(key)}: ${formattedValue}`
          : null;
      })
      .filter(Boolean);

    return formattedEntries.length ? formattedEntries.join("; ") : "—";
  }

  return String(value);
};

const getAnswerUrl = (value) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return "";

  try {
    const parsed = new URL(normalizedValue);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
};

const renderAnswerItem = (answer) => {
  const answerUrl = getAnswerUrl(answer);
  if (answerUrl) {
    const linkLabel = /\.pdf(?:\?|#|$)/i.test(answerUrl) ? "Open document" : "Open link";
    return (
      <a
        href={answerUrl}
        target="_blank"
        rel="noreferrer"
        className="patient-answers-link"
      >
        {linkLabel}
      </a>
    );
  }

  return answer;
};

const renderAnswerContent = (answer) => {
  if (Array.isArray(answer)) {
    return (
      <ul className="patient-answers-list">
        {answer.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{renderAnswerItem(item)}</li>
        ))}
      </ul>
    );
  }

  return renderAnswerItem(answer);
};

const isBlankAnswerValue = (value) => {
  if (value === null || value === undefined) return true;

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isBlankAnswerValue(item));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length === 0 || entries.every(([, nestedValue]) => isBlankAnswerValue(nestedValue));
  }

  return false;
};

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

const getPatientCompanyIds = (patient) =>
  (patient?.companies ?? [])
    .map((entry) => Number(entry?.company?.company_id ?? entry?.company_id ?? entry?.company?.id ?? 0))
    .filter((id) => Number.isFinite(id) && id > 0);

const Patients = () => {
  const { user } = useOutletContext() || {};
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("patient_id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modalMode, setModalMode] = useState(null); // "view" | "edit"
  const [assessmentPatient, setAssessmentPatient] = useState(null);

  const userTypeId = getUserTypeId(user);
  const selectedCompany = getSelectedCompany();
  const useClientTerminology = shouldUseClientTerminology(user, selectedCompany);
  const patientLabels = getPatientLabels(useClientTerminology);
  const selectedCompanyId = Number(
    selectedCompany?.company_id ?? selectedCompany?.id ?? selectedCompany?.company?.company_id ?? 0
  );
  const isCompanyRestrictedUser = userTypeId === 1 || userTypeId === 2;

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const withSlashRes = await apiRequest(PATIENTS_VIEW_API_URL);
        if (withSlashRes.ok) {
          const data = await withSlashRes.json();
          setPatients(Array.isArray(data) ? data : []);
          return;
        }

        const noSlashRes = await apiRequest(PATIENTS_VIEW_API_URL.replace(/\/$/, ""));
        if (!noSlashRes.ok) {
          throw new Error(`Patients view request failed (${noSlashRes.status})`);
        }

        const fallbackData = await noSlashRes.json();
        setPatients(Array.isArray(fallbackData) ? fallbackData : []);
      } catch (error) {
        console.error("Failed to load patients view", error);
        setPatients([]);
      }
    };

    loadPatients();
  }, []);

  /* ----------------------------------
     Helpers
  ---------------------------------- */

  const getCompanyNames = useCallback(
    (p) =>
      p.companies
        ?.map((c) => c?.company?.company_name ?? c?.company_name ?? "")
        .filter(Boolean)
        .join(", ") || "",
    []
  );

  const matchesSearch = useCallback(
    (p) => {
      const searchText = search.toLowerCase();
      return (
        p.patient_id.toString().includes(searchText) ||
        p.first_name.toLowerCase().includes(searchText) ||
        p.last_name.toLowerCase().includes(searchText) ||
        p.email.toLowerCase().includes(searchText) ||
        getCompanyNames(p).toLowerCase().includes(searchText) ||
        p.created_on.toLowerCase().includes(searchText)
      );
    },
    [search, getCompanyNames]
  );

  const sortedPatients = useMemo(() => {
    return [...patients]
      .filter((patient) => {
        if (!isCompanyRestrictedUser) return true;
        if (!selectedCompanyId) return false;

        return getPatientCompanyIds(patient).includes(selectedCompanyId);
      })
      .filter(matchesSearch)
      .sort((a, b) => {
        let valA;
        let valB;

        switch (sortField) {
          case "company":
            valA = getCompanyNames(a);
            valB = getCompanyNames(b);
            break;
          default:
            valA = a[sortField];
            valB = b[sortField];
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    patients,
    sortField,
    sortDirection,
    matchesSearch,
    getCompanyNames,
    isCompanyRestrictedUser,
    selectedCompanyId,
  ]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  /* ----------------------------------
     Render
  ---------------------------------- */

  return (
    <div className="patients-page">
      <h1>{patientLabels.plural}</h1>
        <div className="patients-toolbar">
            <input
                className="search-bar"
                placeholder={`Search ${patientLabels.pluralLower}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        <div className="patients-actions">
            <button
              className="assessments-action-btn"
                style={{ marginBottom: "12px", fontSize: "0.95rem" }}
                onClick={() => {
                    setSelectedPatient(null);
                    setModalMode("add");
                }}
                >
                    + Add New {patientLabels.singular}
            </button>
        </div>

      <table className="patients-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort("patient_id")}>ID</th>
            <th onClick={() => toggleSort("first_name")}>First Name</th>
            <th onClick={() => toggleSort("last_name")}>Last Name</th>
            <th onClick={() => toggleSort("email")}>Email</th>
            <th onClick={() => toggleSort("company")}>Company</th>
            <th onClick={() => toggleSort("created_on")}>Created</th>
            <th>Assessments</th>
            <th>{patientLabels.singular} Info</th>
          </tr>
        </thead>

        <tbody>
          {sortedPatients.map((p) => (
            <tr
              key={p.patient_id}
              onClick={() => {
                setSelectedPatient(p);
                setModalMode("view");
              }}
              style={{ cursor: "pointer" }}
            >
              <td>{p.patient_id}</td>
              <td>{p.first_name}</td>
              <td>{p.last_name}</td>
              <td>{p.email}</td>
              <td>{getCompanyNames(p)}</td>
              <td>{new Date(p.created_on).toLocaleDateString()}</td>
              <td>
                <button
                  className="assessments-action-btn"
                  title="Assessments"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAssessmentPatient(p);
                  }}
                >
                  Manage
                </button>
              </td>
              <td className="actions">
                <button
                  title="View Details"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPatient(p);
                    setModalMode("view");
                  }}
                >
                  👁
                </button>
                <button
                  title={`Edit ${patientLabels.singular}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPatient(p);
                    setModalMode("edit");
                  }}
                >
                  ✏️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalMode && (
        modalMode === "add" ? (
            <AddPatientModal
          restrictedCompanyId={isCompanyRestrictedUser ? selectedCompanyId : null}
            onClose={() => setModalMode(null)}
            onCreated={(newPatient) => {
                setPatients((prev) => [...prev, newPatient]);
                setModalMode(null);
            }}
            />
        ) : (
            <PatientModal
            patient={selectedPatient}
            mode={modalMode}
            onClose={() => setModalMode(null)}
            onUpdated={(updatedPatient) => {
              setPatients((prev) =>
                prev.map((p) =>
                  p.patient_id === updatedPatient.patient_id ? updatedPatient : p
                )
              );
              setSelectedPatient(updatedPatient);
              setModalMode(null);
            }}
            />
        )
        )}

      {assessmentPatient && (
        <PatientAssessmentsModal
          patient={assessmentPatient}
          onClose={() => setAssessmentPatient(null)}
        />
      )}
    </div>
  );
};

export default Patients;

/* ----------------------------------
   Modal Component
---------------------------------- */

const PatientModal = ({ patient, mode, onClose, onUpdated }) => {
  const isEdit = mode === "edit";

  const [firstName, setFirstName] = useState(patient?.first_name || "");
  const [lastName, setLastName] = useState(patient?.last_name || "");
  const [email, setEmail] = useState(patient?.email || "");
  const [dob, setDob] = useState(patient?.dob || "");
  const [patientTypeId, setPatientTypeId] = useState(
    patient?.patient_type?.patient_type_id || ""
  );
  const [patientTypes, setPatientTypes] = useState([]);
  const [isActive, setIsActive] = useState(
    patient ? patient.is_active : false
  );
  const [patientPeople, setPatientPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [removingLinkId, setRemovingLinkId] = useState(null);
  const [patientEvents, setPatientEvents] = useState([]);
  const [injuryEventTypes, setInjuryEventTypes] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [isDeleteEventOpen, setIsDeleteEventOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [deletingEventInProgress, setDeletingEventInProgress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phones, setPhones] = useState(patient?.phones || []);
  const [initialPersistedPhoneIds, setInitialPersistedPhoneIds] = useState([]);
  const [addresses, setAddresses] = useState(patient?.addresses || []);
  const [phoneTypes, setPhoneTypes] = useState([]);
  const [addressTypes, setAddressTypes] = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [editingPhoneKey, setEditingPhoneKey] = useState(null);
  const [isDeletePhoneOpen, setIsDeletePhoneOpen] = useState(false);
  const [deletingPhoneKey, setDeletingPhoneKey] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [newPhoneData, setNewPhoneData] = useState({
    phone: "",
    phone_type_id: "",
  });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressKey, setEditingAddressKey] = useState(null);
  const [isDeleteAddressOpen, setIsDeleteAddressOpen] = useState(false);
  const [deletingAddressKey, setDeletingAddressKey] = useState(null);
  const [addressError, setAddressError] = useState("");
  const [isPartnersSectionOpen, setIsPartnersSectionOpen] = useState(false);
  const [isEventsSectionOpen, setIsEventsSectionOpen] = useState(false);
  const [isAddressesSectionOpen, setIsAddressesSectionOpen] = useState(false);
  const [isPhonesSectionOpen, setIsPhonesSectionOpen] = useState(true);
  const [newAddressData, setNewAddressData] = useState({
    street_1: "",
    street_2: "",
    city: "",
    st: "",
    zip: "",
    country: "United States",
    address_type_id: "",
  });

  const patientCompanyId = Number(
    patient?.companies?.[0]?.company?.company_id ??
    patient?.companies?.[0]?.company_id ??
    0
  );

  useEffect(() => {
    if (patient) {
      setFirstName(patient.first_name || "");
      setLastName(patient.last_name || "");
      setEmail(patient.email || "");
      setDob(patient.dob || "");
      setPatientTypeId(patient.patient_type?.patient_type_id || "");
      setIsActive(patient.is_active);
      setPhones(Array.isArray(patient.phones) ? patient.phones : []);
      setInitialPersistedPhoneIds(
        Array.from(
          new Set(
            (Array.isArray(patient.phones) ? patient.phones : [])
              .map(getPersistedPhoneId)
              .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
              .map((id) => Number(id))
          )
        )
      );
      setAddresses(Array.isArray(patient.addresses) ? patient.addresses : []);
    }
  }, [patient]);

  useEffect(() => {
    setIsPhonesSectionOpen(true);
    setIsPartnersSectionOpen(false);
    setIsEventsSectionOpen(false);
    setIsAddressesSectionOpen(false);
  }, [patient?.patient_id, mode]);

  useEffect(() => {
    Promise.all([
      apiRequest(PATIENT_TYPES_API).then((res) => res.json()),
      apiRequest(PHONE_TYPES_API).then((res) => res.json()),
      apiRequest(ADDRESS_TYPES_API).then((res) => res.json()),
      apiRequest(INJURY_EVENT_TYPES_API).then((res) => res.json()),
    ])
      .then(([patientTypeRows, phoneTypeRows, addressTypeRows, injuryEventTypeRows]) => {
        setPatientTypes(patientTypeRows);
        setPhoneTypes(phoneTypeRows);
        setAddressTypes(addressTypeRows);
        setInjuryEventTypes(injuryEventTypeRows);
      })
      .catch(console.error);
  }, []);

  const loadPatientPeople = useCallback(async () => {
    if (!patient?.patient_id) return;

    setPeopleLoading(true);
    try {
      const res = await apiRequest(PATIENT_PEOPLE_API);
      const allLinks = await res.json();

      const linksForPatient = allLinks
        .filter((pp) => getPatientIdFromPatientPerson(pp) === Number(patient.patient_id))
        .map((pp) => {
          const person = getPersonFromRelation(pp);
          return {
            patient_person_id: getPatientPersonId(pp),
            person_id: getPersonIdFromPatientPerson(pp),
            first_name: person?.first_name || "",
            last_name: person?.last_name || "",
            email: person?.email || "",
            phone: person?.phone || "",
            person_type_description: getPersonTypeDescription(person),
          };
        });

      setPatientPeople(linksForPatient);
    } catch (err) {
      console.error("Load patient people failed", err);
      setPatientPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    loadPatientPeople();
  }, [loadPatientPeople]);

  const loadPatientEvents = useCallback(async () => {
    if (!patient?.patient_id) return;

    setEventsLoading(true);
    try {
      const res = await apiRequest(PATIENT_EVENTS_API);
      const allEvents = await res.json();

      const eventsForPatient = allEvents.filter(
        (item) => getPatientIdFromPatientEvent(item) === Number(patient.patient_id)
      );

      setPatientEvents(eventsForPatient);
    } catch (err) {
      console.error("Load patient events failed", err);
      setPatientEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    loadPatientEvents();
  }, [loadPatientEvents]);

  const loadPatientPhonesAndAddresses = useCallback(async () => {
    if (!patient?.patient_id) return;

    try {
      const [phoneRes, addressRes] = await Promise.all([
        apiRequest(PATIENT_PHONES_API),
        apiRequest(PATIENT_ADDRESSES_API),
      ]);

      const phonePayload = await phoneRes.json();
      const addressPayload = await addressRes.json();

      const phoneRows = Array.isArray(phonePayload)
        ? phonePayload
        : Array.isArray(phonePayload?.results)
          ? phonePayload.results
          : [];

      const addressRows = Array.isArray(addressPayload)
        ? addressPayload
        : Array.isArray(addressPayload?.results)
          ? addressPayload.results
          : [];

      const currentPatientId = Number(patient.patient_id ?? 0);

      const filteredPhones = phoneRows
        .filter((phone) => {
          return currentPatientId > 0 && getPhonePatientId(phone) === currentPatientId;
        })
        .map((phone) => ({
          ...phone,
          phone: phone?.phone ?? "",
          phone_type: phone?.phone_type ?? {
            phone_type_id: phone?.phone_type_id ?? "",
            description: "",
          },
        }));

      const filteredAddresses = addressRows
        .filter((address) => {
          return currentPatientId > 0 && getAddressPatientId(address) === currentPatientId;
        })
        .map((address) => ({
          ...address,
          address_type: address?.address_type ?? {
            address_type_id: address?.address_type_id ?? "",
            description: "",
          },
        }));

      setPhones(filteredPhones);
      setInitialPersistedPhoneIds(
        Array.from(
          new Set(
            filteredPhones
              .map(getPersistedPhoneId)
              .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
              .map((id) => Number(id))
          )
        )
      );
      setAddresses(filteredAddresses);
    } catch (error) {
      console.error("Load patient phones/addresses failed", error);
    }
  }, [patient]);

  useEffect(() => {
    loadPatientPhonesAndAddresses();
  }, [loadPatientPhonesAndAddresses]);

  const postPatientLinkedRecord = async (baseUrl, basePayload, patientId) => {
    const relationCandidates = getPatientRelationCandidates(patientId);
    if (relationCandidates.length === 0) {
      throw new Error("Patient ID is required.");
    }

    let lastErrorMessage = "Unknown error";

    for (const relationPayload of relationCandidates) {
      const response = await apiRequest(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...basePayload,
          ...relationPayload,
        }),
      });

      if (response.ok) {
        return response;
      }

      lastErrorMessage = await getResponseErrorMessage(response);
    }

    throw new Error(lastErrorMessage);
  };

  const openAddPhoneModal = () => {
    setEditingPhoneKey(null);
    setNewPhoneData({ phone: "", phone_type_id: "" });
    setPhoneError("");
    setShowPhoneModal(true);
  };

  const openEditPhoneModal = (phone) => {
    setEditingPhoneKey(getPhoneRowKey(phone));
    setNewPhoneData({
      phone: phone?.phone || "",
      phone_type_id: String(phone?.phone_type?.phone_type_id ?? phone?.phone_type_id ?? ""),
    });
    setPhoneError("");
    setShowPhoneModal(true);
  };

  const handleSavePhoneFromModal = () => {
    const phoneDigits = normalizePhoneDigits(newPhoneData.phone);
    const phoneTypeId = Number(newPhoneData.phone_type_id);

    if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
      setPhoneError("Phone number and Phone Type are required.");
      return;
    }

    const selectedPhoneType = phoneTypes.find(
      (type) => Number(type.phone_type_id) === phoneTypeId
    );

    const normalizedPhone = {
      phone: phoneDigits,
      phone_type: selectedPhoneType || {
        phone_type_id: phoneTypeId,
        description: "",
      },
    };

    if (editingPhoneKey !== null) {
      setPhones((prev) =>
        prev.map((phone) =>
          getPhoneRowKey(phone) === editingPhoneKey
            ? { ...phone, ...normalizedPhone }
            : phone
        )
      );
    } else {
      setPhones((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...normalizedPhone,
          _isNew: true,
        },
      ]);
    }

    setShowPhoneModal(false);
    setEditingPhoneKey(null);
    setPhoneError("");
  };

  const handleRequestDeletePhone = (phoneKey) => {
    setDeletingPhoneKey(phoneKey);
    setIsDeletePhoneOpen(true);
  };

  const handleConfirmDeletePhone = () => {
    if (deletingPhoneKey === null) return;

    setPhones((prev) => prev.filter((phone) => getPhoneRowKey(phone) !== deletingPhoneKey));
    setDeletingPhoneKey(null);
    setIsDeletePhoneOpen(false);
  };

  const openAddAddressModal = () => {
    setEditingAddressKey(null);
    setNewAddressData({
      street_1: "",
      street_2: "",
      city: "",
      st: "",
      zip: "",
      country: "United States",
      address_type_id: "",
    });
    setAddressError("");
    setShowAddressModal(true);
  };

  const openEditAddressModal = (address) => {
    setEditingAddressKey(getAddressRowKey(address));
    setNewAddressData({
      street_1: address?.street_1 || "",
      street_2: address?.street_2 || "",
      city: address?.city || "",
      st: address?.st || "",
      zip: address?.zip || "",
      country: address?.country || "United States",
      address_type_id: String(
        address?.address_type?.address_type_id ??
        address?.address_type_id ??
        ""
      ),
    });
    setAddressError("");
    setShowAddressModal(true);
  };

  const handleSaveAddressFromModal = async () => {
    const addressTypeId = Number(newAddressData.address_type_id);
    if (!newAddressData.street_1.trim() || Number.isNaN(addressTypeId) || addressTypeId <= 0) {
      setAddressError("Address line 1 and Address Type are required.");
      return;
    }

    const selectedAddressType = addressTypes.find(
      (type) => Number(type.address_type_id) === addressTypeId
    );

    const normalizedAddress = {
      street_1: newAddressData.street_1.trim(),
      street_2: newAddressData.street_2.trim(),
      city: newAddressData.city.trim(),
      st: newAddressData.st.trim(),
      zip: newAddressData.zip.trim(),
      country: newAddressData.country.trim(),
      address_type: selectedAddressType || {
        address_type_id: addressTypeId,
        description: "",
      },
    };

    try {
      if (editingAddressKey !== null) {
        const targetAddress = addresses.find(
          (address) => getAddressRowKey(address) === editingAddressKey
        );
        const persistedAddressId = getPersistedAddressId(targetAddress);

        if (!persistedAddressId) {
          throw new Error("Address ID is missing for update.");
        }

        const relationCandidates = getPatientRelationCandidates(patient.patient_id);
        let updateAddressRes = null;
        let lastAddressUpdateError = "Unknown error";

        for (const relationPayload of relationCandidates) {
          const updatePayload = {
            ...normalizedAddress,
            address_type_id: addressTypeId,
            ...relationPayload,
          };

          updateAddressRes = await apiRequest(
            `${PATIENT_ADDRESSES_API}${persistedAddressId}/`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updatePayload),
            }
          );

          if (!updateAddressRes.ok && updateAddressRes.status === 405) {
            updateAddressRes = await apiRequest(
              `${PATIENT_ADDRESSES_API}${persistedAddressId}/`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
              }
            );
          }

          if (updateAddressRes.ok) {
            break;
          }

          lastAddressUpdateError = await getResponseErrorMessage(updateAddressRes);
        }

        if (!updateAddressRes || !updateAddressRes.ok) {
          throw new Error(`Address update failed: ${lastAddressUpdateError}`);
        }

        await loadPatientPhonesAndAddresses();
      } else {
        await postPatientLinkedRecord(
          PATIENT_ADDRESSES_API,
          {
            ...normalizedAddress,
            address_type_id: addressTypeId,
          },
          patient.patient_id
        );

        await loadPatientPhonesAndAddresses();
      }

      setShowAddressModal(false);
      setEditingAddressKey(null);
      setAddressError("");
    } catch (error) {
      setAddressError(error?.message || "Failed to save address");
    }
  };

  const handleRequestDeleteAddress = (addressKey) => {
    setDeletingAddressKey(addressKey);
    setIsDeleteAddressOpen(true);
  };

  const handleConfirmDeleteAddress = async () => {
    if (deletingAddressKey === null) return;

    const targetAddress = addresses.find(
      (address) => getAddressRowKey(address) === deletingAddressKey
    );
    const persistedAddressId = getPersistedAddressId(targetAddress);

    if (persistedAddressId) {
      try {
        const deleteAddressRes = await apiRequest(
          `${PATIENT_ADDRESSES_API}${persistedAddressId}/`,
          { method: "DELETE" }
        );

        if (!deleteAddressRes.ok && deleteAddressRes.status !== 204) {
          const errorMessage = await getResponseErrorMessage(deleteAddressRes);
          throw new Error(`Address delete failed: ${errorMessage}`);
        }
      } catch (error) {
        setAddressError(error?.message || "Failed to delete address");
        setDeletingAddressKey(null);
        setIsDeleteAddressOpen(false);
        return;
      }
    }

    await loadPatientPhonesAndAddresses();
    setDeletingAddressKey(null);
    setIsDeleteAddressOpen(false);
  };

  if (!patient) return null;

  const useClientTerminology = shouldUseClientTerminology();
  const patientLabels = getPatientLabels(useClientTerminology);

  const companyNames =
    patient.companies
      ?.map((c) => c?.company?.company_name ?? c?.company_name ?? "")
      .filter(Boolean)
      .join(", ") || "—";

  const selectedPatientTypeDescription =
    patientTypes.find((pt) => Number(pt.patient_type_id) === Number(patientTypeId))?.description ||
    patient?.patient_type?.description ||
    "—";

  const dateOfBirthDisplay = patient?.dob ? new Date(patient.dob).toLocaleDateString() : "—";

  const linkedPersonIds = patientPeople.map((pp) => pp.person_id);

  const handleRemovePerson = async (patientPersonId) => {
    if (!patientPersonId) return;

    setRemovingLinkId(patientPersonId);
    try {
      await apiRequest(`${PATIENT_PEOPLE_API}${patientPersonId}/`, {
        method: "DELETE",
      });

      setPatientPeople((prev) =>
        prev.filter((pp) => pp.patient_person_id !== patientPersonId)
      );
    } catch (err) {
      console.error("Remove person from patient failed", err);
    } finally {
      setRemovingLinkId(null);
    }
  };

  const handleSavePatient = async () => {
    if (!patient?.patient_id) return;

    setSaving(true);
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email,
        dob,
        patient_type_id: patientTypeId ? Number(patientTypeId) : null,
        is_active: isActive,
      };

      let response = await apiRequest(`${PATIENTS_API_URL}${patient.patient_id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status === 405) {
        response = await apiRequest(`${PATIENTS_API_URL}${patient.patient_id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        throw new Error(`Update failed with status ${response.status}`);
      }

      const updatedPatient = await response.json();

      const relationCandidates = getPatientRelationCandidates(patient.patient_id);

      const currentPersistedPhoneIds = new Set(
        phones
          .map(getPersistedPhoneId)
          .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
          .map((id) => Number(id))
      );

      const phoneIdsToDelete = initialPersistedPhoneIds.filter(
        (id) => !currentPersistedPhoneIds.has(Number(id))
      );

      for (const phoneId of phoneIdsToDelete) {
        const deletePhoneRes = await apiRequest(`${PATIENT_PHONES_API}${phoneId}/`, {
          method: "DELETE",
        });

        if (!deletePhoneRes.ok && deletePhoneRes.status !== 204) {
          const errorMessage = await getResponseErrorMessage(deletePhoneRes);
          throw new Error(`Phone delete failed: ${errorMessage}`);
        }
      }

      for (const phoneRow of phones) {
        const phoneDigits = normalizePhoneDigits(phoneRow.phone);
        const phoneTypeId = Number(phoneRow?.phone_type?.phone_type_id ?? phoneRow?.phone_type_id);

        if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
          throw new Error("Each phone requires a phone number and phone type.");
        }

        const persistedPhoneId = Number(getPersistedPhoneId(phoneRow));

        if (Number.isFinite(persistedPhoneId) && persistedPhoneId > 0) {
          let updatePhoneRes = null;
          let lastPhoneUpdateError = "Unknown error";

          for (const relationPayload of relationCandidates) {
            const updatePayload = {
              phone: phoneDigits,
              phone_type_id: phoneTypeId,
              ...relationPayload,
            };

            updatePhoneRes = await apiRequest(
              `${PATIENT_PHONES_API}${persistedPhoneId}/`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload),
              }
            );

            if (!updatePhoneRes.ok && updatePhoneRes.status === 405) {
              updatePhoneRes = await apiRequest(
                `${PATIENT_PHONES_API}${persistedPhoneId}/`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updatePayload),
                }
              );
            }

            if (updatePhoneRes.ok) {
              break;
            }

            lastPhoneUpdateError = await getResponseErrorMessage(updatePhoneRes);
          }

          if (!updatePhoneRes || !updatePhoneRes.ok) {
            throw new Error(`Phone update failed: ${lastPhoneUpdateError}`);
          }
        } else {
          await postPatientLinkedRecord(
            PATIENT_PHONES_API,
            {
              phone: phoneDigits,
              phone_type_id: phoneTypeId,
            },
            patient.patient_id
          );
        }
      }

      await loadPatientPhonesAndAddresses();

      if (onUpdated) {
        onUpdated(updatedPatient);
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Update patient failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddEvent = () => {
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleOpenEditEvent = (eventItem) => {
    setEditingEvent(eventItem);
    setShowEventModal(true);
  };

  const handleOpenDeleteEvent = (eventItem) => {
    setDeletingEvent(eventItem);
    setIsDeleteEventOpen(true);
  };

  const handleDeleteEvent = async () => {
    const eventId = deletingEvent ? getPatientEventId(deletingEvent) : null;
    if (!eventId) return;

    setDeletingEventInProgress(true);
    try {
      const response = await apiRequest(`${PATIENT_EVENTS_API}${eventId}/`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Delete event failed with status ${response.status}`);
      }

      setPatientEvents((prev) =>
        prev.filter((item) => getPatientEventId(item) !== eventId)
      );
      setIsDeleteEventOpen(false);
      setDeletingEvent(null);
    } catch (err) {
      console.error("Delete patient event failed", err);
    } finally {
      setDeletingEventInProgress(false);
    }
  };

  const handleSavePatientEvent = async ({ event, eventDate, injuryEventTypeId }) => {
    if (!patient?.patient_id) return;

    const payload = {
      patient_id: patient.patient_id,
      event,
      event_date: eventDate,
      injury_event_type_id: Number(injuryEventTypeId),
    };

    setSavingEvent(true);
    try {
      const existingEventId = editingEvent ? getPatientEventId(editingEvent) : null;

      if (existingEventId) {
        let response = await apiRequest(`${PATIENT_EVENTS_API}${existingEventId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok && response.status === 405) {
          response = await apiRequest(`${PATIENT_EVENTS_API}${existingEventId}/`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (!response.ok) {
          throw new Error(`Update event failed with status ${response.status}`);
        }
      } else {
        const response = await apiRequest(PATIENT_EVENTS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Create event failed with status ${response.status}`);
        }
      }

      setShowEventModal(false);
      setEditingEvent(null);
      await loadPatientEvents();
    } catch (err) {
      console.error("Save patient event failed", err);
    } finally {
      setSavingEvent(false);
    }
  };

  const formatEventDate = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern patient-modal">
        <div className="modal-header">
          <h3>
            {isEdit
              ? `EDIT ${patientLabels.singular.toUpperCase()}`
              : `${patientLabels.singular.toUpperCase()} DETAILS`}
          </h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="patient-profile-layout">
          <div className="patient-profile-left">
            <div className="patient-profile-identity-card">
              <div className="patient-profile-avatar">
                {`${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "P"}
              </div>
              <div className="patient-profile-name">
                {`${firstName || ""} ${lastName || ""}`.trim() || patientLabels.singular}
              </div>
            </div>

            <div className="patient-profile-fields-card">
              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">First Name</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  ) : (
                    firstName || "—"
                  )}
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Last Name</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  ) : (
                    lastName || "—"
                  )}
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Email</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <input value={email} onChange={(e) => setEmail(e.target.value)} />
                  ) : (
                    email || "—"
                  )}
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Date of Birth</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  ) : (
                    dateOfBirthDisplay
                  )}
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">{patientLabels.singular} Type</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <select value={patientTypeId} onChange={(e) => setPatientTypeId(e.target.value)}>
                      <option value="">Select type</option>
                      {patientTypes.map((pt) => (
                        <option key={pt.patient_type_id} value={pt.patient_type_id}>
                          {pt.description}
                        </option>
                      ))}
                    </select>
                  ) : (
                    selectedPatientTypeDescription
                  )}
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Company</span>
                <div className="patient-profile-field-value">{companyNames}</div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Status</span>
                <div className="patient-profile-field-value">
                  {isEdit ? (
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span>{isActive ? "Active" : "Inactive"}</span>
                    </label>
                  ) : (
                    <span className={`status-pill ${isActive ? "active" : "inactive"}`}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="patient-profile-right">
            <div className="patient-data-card">
              <button
                type="button"
                className="patient-data-card-header patient-data-card-header-toggle"
                onClick={() => setIsPhonesSectionOpen((prev) => !prev)}
                aria-expanded={isPhonesSectionOpen}
              >
                <span>Phones</span>
                <span className="patient-card-chevron">{isPhonesSectionOpen ? "▾" : "▸"}</span>
              </button>

              {isPhonesSectionOpen && (
                <div className="patient-data-card-body">
                  {phones.length === 0 ? (
                    <p className="people-empty">No phones added.</p>
                  ) : (
                    <div className="user-phones-grid">
                      {phones.map((phoneRow) => (
                        <div key={getPhoneRowKey(phoneRow) ?? `phone-${phoneRow.phone ?? ""}`} className="user-phone-card">
                          <div className="user-phone-card-top">
                            <strong>
                              {phoneRow?.phone_type?.description ||
                                phoneTypes.find(
                                  (phoneType) =>
                                    Number(phoneType.phone_type_id) ===
                                    Number(phoneRow?.phone_type?.phone_type_id ?? phoneRow?.phone_type_id)
                                )?.description ||
                                "Phone"}
                            </strong>

                            {isEdit && (
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <button
                                  type="button"
                                  className="icon-edit"
                                  title="Edit phone"
                                  onClick={() => openEditPhoneModal(phoneRow)}
                                >
                                  ✏️
                                </button>
                                <FaTrash
                                  className="icon-button"
                                  style={{ color: "#dc2626" }}
                                  onClick={() => handleRequestDeletePhone(getPhoneRowKey(phoneRow))}
                                />
                              </div>
                            )}
                          </div>

                          <div className="user-phone-card-body">
                            <p>{formatPhoneForInput(phoneRow.phone) || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isEdit && (
                    <button type="button" className="user-address-add-btn" onClick={openAddPhoneModal}>
                      + Add Phone
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="patient-data-card people-section">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isPartnersSectionOpen}
                  onClick={() => setIsPartnersSectionOpen((prev) => !prev)}
                >
                  <span>Associated Partners</span>
                  <span className="patient-card-chevron">{isPartnersSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isPartnersSectionOpen && (
                <div className="patient-data-card-body">
                  {peopleLoading ? (
                    <div className="people-empty">Loading people...</div>
                  ) : patientPeople.length === 0 ? (
                    <div className="people-empty">
                      No people associated with this {patientLabels.singularLower}.
                    </div>
                  ) : (
                    <div className="people-list">
                      {patientPeople.map((pp) => (
                        <div className="people-row" key={`${pp.person_id}-${pp.patient_person_id ?? "temp"}`}>
                          <div>
                            <div className="people-name">{getPersonDisplayName(pp)}</div>
                            <div className="people-type">{pp.person_type_description}</div>
                          </div>
                          {isEdit && (
                            <button
                              type="button"
                              className="icon-remove"
                              title="Remove person"
                              style={{ color: "#dc2626" }}
                              disabled={removingLinkId === pp.patient_person_id || !pp.patient_person_id}
                              onClick={() => handleRemovePerson(pp.patient_person_id)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isEdit && (
                    <button
                      type="button"
                      className="user-address-add-btn"
                      onClick={() => setShowPersonModal(true)}
                    >
                      + Add Partner
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="patient-data-card user-addresses-section">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isAddressesSectionOpen}
                  onClick={() => setIsAddressesSectionOpen((prev) => !prev)}
                >
                  <span>Addresses</span>
                  <span className="patient-card-chevron">{isAddressesSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isAddressesSectionOpen && (
                <div className="patient-data-card-body">
                  {addresses.length === 0 ? (
                    <p className="user-addresses-empty">No addresses added.</p>
                  ) : (
                    <div className="user-addresses-grid">
                      {addresses.map((address) => (
                        <div key={getAddressRowKey(address)} className="user-address-card">
                          <div className="user-address-card-top">
                            <strong>{address?.address_type?.description || "Address"}</strong>
                            {isEdit && (
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <button
                                  type="button"
                                  className="icon-edit"
                                  title="Edit address"
                                  onClick={() => openEditAddressModal(address)}
                                >
                                  ✏️
                                </button>
                                <FaTrash
                                  className="icon-button"
                                  style={{ color: "#dc2626" }}
                                  onClick={() => handleRequestDeleteAddress(getAddressRowKey(address))}
                                />
                              </div>
                            )}
                          </div>

                          <div className="user-address-card-body">
                            <p>{address?.street_1 || "—"}</p>
                            {address?.street_2?.trim() && <p>{address.street_2}</p>}
                            <p>
                              {address?.city || ""}
                              {address?.city && address?.st ? ", " : ""}
                              {address?.st || ""}
                              {(address?.city || address?.st) && address?.zip ? " " : ""}
                              {address?.zip || (!(address?.city || address?.st) ? "—" : "")}
                            </p>
                            <p>{address?.country || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isEdit && (
                    <button type="button" className="user-address-add-btn" onClick={openAddAddressModal}>
                      + Add Address
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="patient-data-card events-section events-section-full-width">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isEventsSectionOpen}
                  onClick={() => setIsEventsSectionOpen((prev) => !prev)}
                >
                  <span>Injury Events</span>
                  <span className="patient-card-chevron">{isEventsSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isEventsSectionOpen && (
                <div className="patient-data-card-body">
                  {eventsLoading ? (
                    <div className="people-empty">Loading events...</div>
                  ) : patientEvents.length === 0 ? (
                    <div className="people-empty">
                      No injury events associated with this {patientLabels.singularLower}.
                    </div>
                  ) : (
                    <div className="events-table-wrap">
                      <table className="events-table">
                        <colgroup>
                          <col className="events-col-event" />
                          <col className="events-col-type" />
                          <col className="events-col-date" />
                          {isEdit && <col className="events-col-actions" />}
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Event Type</th>
                            <th>Event Date</th>
                            {isEdit && <th>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {patientEvents.map((eventItem, index) => (
                            <tr key={getPatientEventId(eventItem) ?? `${eventItem.event}-${index}`}>
                              <td>{eventItem.event || "—"}</td>
                              <td>{getInjuryEventTypeDescription(eventItem)}</td>
                              <td>{formatEventDate(eventItem.event_date)}</td>
                              {isEdit && (
                                <td className="event-actions-cell">
                                  <div className="event-actions">
                                    <button
                                      type="button"
                                      className="icon-edit"
                                      title="Edit injury event"
                                      onClick={() => handleOpenEditEvent(eventItem)}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-remove"
                                      title="Delete injury event"
                                      onClick={() => handleOpenDeleteEvent(eventItem)}
                                    >
                                      <FaTrash style={{ color: "#dc2626" }} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isEdit && (
                    <button type="button" className="user-address-add-btn" onClick={handleOpenAddEvent}>
                      + Add Injury Event
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          {isEdit && (
            <button className="primary" onClick={handleSavePatient} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {showPersonModal && (
          <PatientPersonModal
            companyId={patientCompanyId}
            patientId={patient.patient_id}
            linkedPersonIds={linkedPersonIds}
            onClose={() => setShowPersonModal(false)}
            onPersonAdded={() => {
              setShowPersonModal(false);
              loadPatientPeople();
            }}
          />
        )}

        {showEventModal && (
          <PatientEventModal
            title={editingEvent ? "Edit Injury Event" : "Add Injury Event"}
            initialEvent={editingEvent}
            saving={savingEvent}
            onCancel={() => {
              if (savingEvent) return;
              setShowEventModal(false);
              setEditingEvent(null);
            }}
            onSave={handleSavePatientEvent}
            injuryEventTypes={injuryEventTypes}
          />
        )}

        {isDeleteEventOpen && deletingEvent && (
          <ConfirmActionModal
            title="Delete Injury Event"
            message="Are you sure you want to delete this injury event?"
            confirmLabel={deletingEventInProgress ? "Deleting..." : "Yes, Delete"}
            disabled={deletingEventInProgress}
            onCancel={() => {
              if (deletingEventInProgress) return;
              setIsDeleteEventOpen(false);
              setDeletingEvent(null);
            }}
            onConfirm={handleDeleteEvent}
          />
        )}

        {showPhoneModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "520px" }}>
              <div className="modal-header">
                <h3>{editingPhoneKey !== null ? "Edit Phone" : "Add Phone"}</h3>
                <button className="icon-close" onClick={() => setShowPhoneModal(false)}>✕</button>
              </div>

              <div className="details-grid">
                <Detail label="Phone">
                  <input
                    inputMode="numeric"
                    value={formatPhoneForInput(newPhoneData.phone)}
                    onChange={(e) =>
                      setNewPhoneData((prev) => ({
                        ...prev,
                        phone: normalizePhoneDigits(e.target.value),
                      }))
                    }
                  />
                </Detail>
                <Detail label="Phone Type">
                  <select
                    value={newPhoneData.phone_type_id}
                    onChange={(e) =>
                      setNewPhoneData((prev) => ({ ...prev, phone_type_id: e.target.value }))
                    }
                  >
                    <option value="">Select Type</option>
                    {phoneTypes.map((phoneType) => (
                      <option key={phoneType.phone_type_id} value={phoneType.phone_type_id}>
                        {phoneType.description}
                      </option>
                    ))}
                  </select>
                </Detail>
              </div>

              <div className="modal-actions">
                {phoneError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{phoneError}</p>}
                <button onClick={() => setShowPhoneModal(false)}>Cancel</button>
                <button className="primary" onClick={handleSavePhoneFromModal}>
                  {editingPhoneKey !== null ? "Save Phone" : "Add Phone"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeletePhoneOpen && (
          <div className="modal-overlay" style={{ zIndex: 1350 }}>
            <div className="modal modern" style={{ width: "460px" }}>
              <div className="modal-header">
                <h3>Delete Phone</h3>
                <button
                  className="icon-close"
                  onClick={() => {
                    setIsDeletePhoneOpen(false);
                    setDeletingPhoneKey(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ marginBottom: "18px", color: "#444" }}>
                Are you sure you want to delete this phone?
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setIsDeletePhoneOpen(false);
                    setDeletingPhoneKey(null);
                  }}
                >
                  Cancel
                </button>
                <button className="primary" onClick={handleConfirmDeletePhone}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddressModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "560px" }}>
              <div className="modal-header">
                <h3>{editingAddressKey !== null ? "Edit Address" : "Add Address"}</h3>
                <button className="icon-close" onClick={() => setShowAddressModal(false)}>✕</button>
              </div>

              <div className="details-grid">
                <Detail label="Street 1">
                  <input
                    value={newAddressData.street_1}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_1: e.target.value }))}
                  />
                </Detail>
                <Detail label="Street 2">
                  <input
                    value={newAddressData.street_2}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_2: e.target.value }))}
                  />
                </Detail>
                <Detail label="City">
                  <input
                    value={newAddressData.city}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </Detail>
                <Detail label="State">
                  <select
                    value={newAddressData.st}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, st: e.target.value }))}
                  >
                    <option value="">Select State</option>
                    {US_STATES.map((stateOption) => (
                      <option key={stateOption.value} value={stateOption.value}>
                        {stateOption.label}
                      </option>
                    ))}
                  </select>
                </Detail>
                <Detail label="Zip">
                  <input
                    value={newAddressData.zip}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, zip: e.target.value }))}
                  />
                </Detail>
                <Detail label="Country">
                  <select
                    value={newAddressData.country}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, country: e.target.value }))}
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </Detail>
                <Detail label="Address Type">
                  <select
                    value={newAddressData.address_type_id}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, address_type_id: e.target.value }))}
                  >
                    <option value="">Select Type</option>
                    {addressTypes.map((addressType) => (
                      <option key={addressType.address_type_id} value={addressType.address_type_id}>
                        {addressType.description}
                      </option>
                    ))}
                  </select>
                </Detail>
              </div>

              <div className="modal-actions">
                {addressError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{addressError}</p>}
                <button onClick={() => setShowAddressModal(false)}>Cancel</button>
                <button className="primary" onClick={handleSaveAddressFromModal}>
                  {editingAddressKey !== null ? "Save Address" : "Add Address"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteAddressOpen && (
          <div className="modal-overlay" style={{ zIndex: 1350 }}>
            <div className="modal modern" style={{ width: "460px" }}>
              <div className="modal-header">
                <h3>Delete Address</h3>
                <button
                  className="icon-close"
                  onClick={() => {
                    setIsDeleteAddressOpen(false);
                    setDeletingAddressKey(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ marginBottom: "18px", color: "#444" }}>
                Are you sure you want to delete this address?
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setIsDeleteAddressOpen(false);
                    setDeletingAddressKey(null);
                  }}
                >
                  Cancel
                </button>
                <button className="primary" onClick={handleConfirmDeleteAddress}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AddPatientModal = ({ onClose, onCreated, restrictedCompanyId = null }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [patientTypeId, setPatientTypeId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const useClientTerminology = shouldUseClientTerminology();
  const patientLabels = getPatientLabels(useClientTerminology);

  const [companies, setCompanies] = useState([]);
  const [patientTypes, setPatientTypes] = useState([]);
  const [stagedPeople, setStagedPeople] = useState([]);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [stagedEvents, setStagedEvents] = useState([]);
  const [injuryEventTypes, setInjuryEventTypes] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [deletingEventIndex, setDeletingEventIndex] = useState(null);
  const [isDeleteEventOpen, setIsDeleteEventOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phones, setPhones] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [phoneTypes, setPhoneTypes] = useState([]);
  const [addressTypes, setAddressTypes] = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [editingPhoneKey, setEditingPhoneKey] = useState(null);
  const [isDeletePhoneOpen, setIsDeletePhoneOpen] = useState(false);
  const [deletingPhoneKey, setDeletingPhoneKey] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [newPhoneData, setNewPhoneData] = useState({
    phone: "",
    phone_type_id: "",
  });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressKey, setEditingAddressKey] = useState(null);
  const [isDeleteAddressOpen, setIsDeleteAddressOpen] = useState(false);
  const [deletingAddressKey, setDeletingAddressKey] = useState(null);
  const [addressError, setAddressError] = useState("");
  const [isPartnersSectionOpen, setIsPartnersSectionOpen] = useState(false);
  const [isEventsSectionOpen, setIsEventsSectionOpen] = useState(false);
  const [isAddressesSectionOpen, setIsAddressesSectionOpen] = useState(false);
  const [isPhonesSectionOpen, setIsPhonesSectionOpen] = useState(true);
  const [newAddressData, setNewAddressData] = useState({
    street_1: "",
    street_2: "",
    city: "",
    st: "",
    zip: "",
    country: "United States",
    address_type_id: "",
  });

  useEffect(() => {
    Promise.all([
      apiRequest(COMPANIES_API).then(r => r.json()),
      apiRequest(PATIENT_TYPES_API).then(r => r.json()),
      apiRequest(PHONE_TYPES_API).then(r => r.json()),
      apiRequest(ADDRESS_TYPES_API).then(r => r.json()),
      apiRequest(INJURY_EVENT_TYPES_API).then(r => r.json()),
    ]).then(([companies, patientTypes, phoneTypeRows, addressTypeRows, injuryEventTypeRows]) => {
      const restrictedId = Number(restrictedCompanyId);
      const filteredCompanies = restrictedId
        ? companies.filter((company) => Number(company.company_id) === restrictedId)
        : companies;

      setCompanies(filteredCompanies);
      if (restrictedId && filteredCompanies.length > 0) {
        setCompanyId(String(restrictedId));
      }
      setPatientTypes(patientTypes);
      setPhoneTypes(phoneTypeRows);
      setAddressTypes(addressTypeRows);
      setInjuryEventTypes(Array.isArray(injuryEventTypeRows) ? injuryEventTypeRows : []);
    });
  }, [restrictedCompanyId]);

  useEffect(() => {
    setStagedPeople([]);
  }, [companyId]);

  const formatEventDate = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const handleRemoveStagedPerson = (personId) => {
    setStagedPeople((prev) => prev.filter((p) => p.person_id !== personId));
  };

  const handleOpenAddEvent = () => {
    setEditingEventIndex(null);
    setShowEventModal(true);
  };

  const handleOpenEditEvent = (index) => {
    setEditingEventIndex(index);
    setShowEventModal(true);
  };

  const handleOpenDeleteEvent = (index) => {
    setDeletingEventIndex(index);
    setIsDeleteEventOpen(true);
  };

  const handleDeleteStagedEvent = () => {
    if (deletingEventIndex === null) return;

    setStagedEvents((prev) => prev.filter((_, index) => index !== deletingEventIndex));
    setDeletingEventIndex(null);
    setIsDeleteEventOpen(false);
  };

  const handleSaveStagedEvent = ({ event, eventDate, injuryEventTypeId }) => {
    const parsedInjuryEventTypeId = Number(injuryEventTypeId);
    const selectedInjuryEventType = injuryEventTypes.find(
      (eventType) => Number(eventType?.injury_event_type_id) === parsedInjuryEventTypeId
    );

    const newEvent = {
      event,
      event_date: eventDate,
      injury_event_type_id: parsedInjuryEventTypeId,
      injury_event_type: selectedInjuryEventType
        ? {
            injury_event_type_id: selectedInjuryEventType.injury_event_type_id,
            description: selectedInjuryEventType.description,
          }
        : null,
    };

    setStagedEvents((prev) => {
      if (editingEventIndex === null) {
        return [...prev, newEvent];
      }

      return prev.map((item, index) => (index === editingEventIndex ? newEvent : item));
    });

    setShowEventModal(false);
    setEditingEventIndex(null);
  };

  const postPatientLinkedRecord = async (baseUrl, basePayload, patientId) => {
    const relationCandidates = getPatientRelationCandidates(patientId);
    if (relationCandidates.length === 0) {
      throw new Error("Patient ID is required.");
    }

    let lastErrorMessage = "Unknown error";

    for (const relationPayload of relationCandidates) {
      const response = await apiRequest(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...basePayload,
          ...relationPayload,
        }),
      });

      if (response.ok) {
        return response;
      }

      lastErrorMessage = await getResponseErrorMessage(response);
    }

    throw new Error(lastErrorMessage);
  };

  const openAddPhoneModal = () => {
    setEditingPhoneKey(null);
    setNewPhoneData({ phone: "", phone_type_id: "" });
    setPhoneError("");
    setShowPhoneModal(true);
  };

  const openEditPhoneModal = (phone) => {
    setEditingPhoneKey(getPhoneRowKey(phone));
    setNewPhoneData({
      phone: phone?.phone || "",
      phone_type_id: String(phone?.phone_type?.phone_type_id ?? phone?.phone_type_id ?? ""),
    });
    setPhoneError("");
    setShowPhoneModal(true);
  };

  const handleSavePhoneFromModal = () => {
    const phoneDigits = normalizePhoneDigits(newPhoneData.phone);
    const phoneTypeId = Number(newPhoneData.phone_type_id);

    if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
      setPhoneError("Phone number and Phone Type are required.");
      return;
    }

    const selectedPhoneType = phoneTypes.find(
      (type) => Number(type.phone_type_id) === phoneTypeId
    );

    const normalizedPhone = {
      phone: phoneDigits,
      phone_type: selectedPhoneType || {
        phone_type_id: phoneTypeId,
        description: "",
      },
      _isNew: true,
    };

    if (editingPhoneKey !== null) {
      setPhones((prev) =>
        prev.map((phone) =>
          getPhoneRowKey(phone) === editingPhoneKey
            ? { ...phone, ...normalizedPhone }
            : phone
        )
      );
    } else {
      setPhones((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...normalizedPhone,
        },
      ]);
    }

    setShowPhoneModal(false);
    setEditingPhoneKey(null);
    setPhoneError("");
  };

  const handleRequestDeletePhone = (phoneKey) => {
    setDeletingPhoneKey(phoneKey);
    setIsDeletePhoneOpen(true);
  };

  const handleConfirmDeletePhone = () => {
    if (deletingPhoneKey === null) return;

    setPhones((prev) => prev.filter((phone) => getPhoneRowKey(phone) !== deletingPhoneKey));
    setDeletingPhoneKey(null);
    setIsDeletePhoneOpen(false);
  };

  const openAddAddressModal = () => {
    setEditingAddressKey(null);
    setNewAddressData({
      street_1: "",
      street_2: "",
      city: "",
      st: "",
      zip: "",
      country: "United States",
      address_type_id: "",
    });
    setAddressError("");
    setShowAddressModal(true);
  };

  const openEditAddressModal = (address) => {
    setEditingAddressKey(getAddressRowKey(address));
    setNewAddressData({
      street_1: address?.street_1 || "",
      street_2: address?.street_2 || "",
      city: address?.city || "",
      st: address?.st || "",
      zip: address?.zip || "",
      country: address?.country || "United States",
      address_type_id: String(
        address?.address_type?.address_type_id ??
        address?.address_type_id ??
        ""
      ),
    });
    setAddressError("");
    setShowAddressModal(true);
  };

  const handleSaveAddressFromModal = () => {
    const addressTypeId = Number(newAddressData.address_type_id);
    if (!newAddressData.street_1.trim() || Number.isNaN(addressTypeId) || addressTypeId <= 0) {
      setAddressError("Address line 1 and Address Type are required.");
      return;
    }

    const selectedAddressType = addressTypes.find(
      (type) => Number(type.address_type_id) === addressTypeId
    );

    const normalizedAddress = {
      street_1: newAddressData.street_1.trim(),
      street_2: newAddressData.street_2.trim(),
      city: newAddressData.city.trim(),
      st: newAddressData.st.trim(),
      zip: newAddressData.zip.trim(),
      country: newAddressData.country.trim(),
      address_type: selectedAddressType || {
        address_type_id: addressTypeId,
        description: "",
      },
      _isNew: true,
    };

    if (editingAddressKey !== null) {
      setAddresses((prev) =>
        prev.map((address) =>
          getAddressRowKey(address) === editingAddressKey
            ? { ...address, ...normalizedAddress }
            : address
        )
      );
    } else {
      setAddresses((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...normalizedAddress,
        },
      ]);
    }

    setShowAddressModal(false);
    setEditingAddressKey(null);
    setAddressError("");
  };

  const handleRequestDeleteAddress = (addressKey) => {
    setDeletingAddressKey(addressKey);
    setIsDeleteAddressOpen(true);
  };

  const handleConfirmDeleteAddress = () => {
    if (deletingAddressKey === null) return;
    setAddresses((prev) => prev.filter((address) => getAddressRowKey(address) !== deletingAddressKey));
    setDeletingAddressKey(null);
    setIsDeleteAddressOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // 1️⃣ Create patient
      const patientRes = await apiRequest(
        PATIENTS_API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            dob,
            patient_type_id: patientTypeId,
            is_active: isActive,
          }),
        }
      );

      const patient = await patientRes.json();

      // 2️⃣ Link patient to company
      await apiRequest(
        COMPANY_PATIENTS_API,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            patient_id: patient.patient_id,
          }),
        }
      );

      for (const person of stagedPeople) {
        try {
          await apiRequest(PATIENT_PEOPLE_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patient.patient_id,
              person_id: person.person_id,
            }),
          });
        } catch (linkErr) {
          console.error("Link person to patient failed", linkErr);
        }
      }

      for (const stagedEvent of stagedEvents) {
        try {
          await apiRequest(PATIENT_EVENTS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patient.patient_id,
              event: stagedEvent.event,
              event_date: stagedEvent.event_date,
              injury_event_type_id: Number(stagedEvent.injury_event_type_id),
            }),
          });
        } catch (eventErr) {
          console.error("Create patient event failed", eventErr);
        }
      }

      for (const phoneRow of phones) {
        const phoneDigits = normalizePhoneDigits(phoneRow.phone);
        const phoneTypeId = Number(phoneRow?.phone_type?.phone_type_id ?? phoneRow?.phone_type_id);

        if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
          continue;
        }

        try {
          await postPatientLinkedRecord(
            PATIENT_PHONES_API,
            {
              phone: phoneDigits,
              phone_type_id: phoneTypeId,
            },
            patient.patient_id
          );
        } catch (phoneErr) {
          console.error("Create patient phone failed", phoneErr);
        }
      }

      for (const address of addresses) {
        const addressTypeId = Number(address?.address_type?.address_type_id ?? address?.address_type_id);
        if (Number.isNaN(addressTypeId) || addressTypeId <= 0) {
          continue;
        }

        try {
          await postPatientLinkedRecord(
            PATIENT_ADDRESSES_API,
            {
              street_1: address?.street_1 ?? "",
              street_2: address?.street_2 ?? "",
              city: address?.city ?? "",
              st: address?.st ?? "",
              zip: address?.zip ?? "",
              country: address?.country ?? "",
              address_type_id: addressTypeId,
            },
            patient.patient_id
          );
        } catch (addressErr) {
          console.error("Create patient address failed", addressErr);
        }
      }

      // 3️⃣ Attach company locally for UI
      const company = companies.find(c => c.company_id === Number(companyId));

      const patientWithCompany = {
        ...patient,
        phones,
        addresses,
        companies: company
          ? [{
              company_patient_id: Date.now(), // temp UI id
              company,
              is_active: true,
            }]
          : [],
      };

      onCreated(patientWithCompany);
    } catch (err) {
      console.error("Create patient failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern patient-modal">
        <div className="modal-header">
          <h3>ADD NEW {patientLabels.singular.toUpperCase()}</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="patient-profile-layout">
          <div className="patient-profile-left">
            <div className="patient-profile-identity-card">
              <div className="patient-profile-avatar">
                {`${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "P"}
              </div>
              <div className="patient-profile-name">
                {`${firstName || ""} ${lastName || ""}`.trim() || `New ${patientLabels.singular}`}
              </div>
            </div>

            <div className="patient-profile-fields-card">
              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">First Name</span>
                <div className="patient-profile-field-value">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Last Name</span>
                <div className="patient-profile-field-value">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Email</span>
                <div className="patient-profile-field-value">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Date of Birth</span>
                <div className="patient-profile-field-value">
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">{patientLabels.singular} Type</span>
                <div className="patient-profile-field-value">
                  <select value={patientTypeId} onChange={(e) => setPatientTypeId(e.target.value)}>
                    <option value="">Select type</option>
                    {patientTypes.map((pt) => (
                      <option key={pt.patient_type_id} value={pt.patient_type_id}>
                        {pt.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Company</span>
                <div className="patient-profile-field-value">
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    disabled={Number(restrictedCompanyId) > 0}
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="patient-profile-field-row">
                <span className="patient-profile-field-label">Status</span>
                <div className="patient-profile-field-value">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>{isActive ? "Active" : "Inactive"}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="patient-profile-right">
            <div className="patient-data-card">
              <button
                type="button"
                className="patient-data-card-header patient-data-card-header-toggle"
                onClick={() => setIsPhonesSectionOpen((prev) => !prev)}
                aria-expanded={isPhonesSectionOpen}
              >
                <span>Phones</span>
                <span className="patient-card-chevron">{isPhonesSectionOpen ? "▾" : "▸"}</span>
              </button>

              {isPhonesSectionOpen && (
                <div className="patient-data-card-body">
                  {phones.length === 0 ? (
                    <p className="people-empty">No phones added.</p>
                  ) : (
                    <div className="user-phones-grid">
                      {phones.map((phoneRow) => (
                        <div key={getPhoneRowKey(phoneRow) ?? `phone-${phoneRow.phone ?? ""}`} className="user-phone-card">
                          <div className="user-phone-card-top">
                            <strong>
                              {phoneRow?.phone_type?.description ||
                                phoneTypes.find(
                                  (phoneType) =>
                                    Number(phoneType.phone_type_id) ===
                                    Number(phoneRow?.phone_type?.phone_type_id ?? phoneRow?.phone_type_id)
                                )?.description ||
                                "Phone"}
                            </strong>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <button
                                type="button"
                                className="icon-edit"
                                title="Edit phone"
                                onClick={() => openEditPhoneModal(phoneRow)}
                              >
                                ✏️
                              </button>
                              <FaTrash
                                className="icon-button"
                                style={{ color: "#dc2626" }}
                                onClick={() => handleRequestDeletePhone(getPhoneRowKey(phoneRow))}
                              />
                            </div>
                          </div>

                          <div className="user-phone-card-body">
                            <p>{formatPhoneForInput(phoneRow.phone) || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className="user-address-add-btn" onClick={openAddPhoneModal}>
                    + Add Phone
                  </button>
                </div>
              )}
            </div>

            <div className="patient-data-card people-section">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isPartnersSectionOpen}
                  onClick={() => setIsPartnersSectionOpen((prev) => !prev)}
                >
                  <span>Associated Partners</span>
                  <span className="patient-card-chevron">{isPartnersSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isPartnersSectionOpen && (
                <div className="patient-data-card-body">
                  {stagedPeople.length === 0 ? (
                    <div className="people-empty">No people added yet.</div>
                  ) : (
                    <div className="people-list">
                      {stagedPeople.map((person) => (
                        <div className="people-row" key={person.person_id}>
                          <div>
                            <div className="people-name">{getPersonDisplayName(person)}</div>
                            <div className="people-type">{getPersonTypeDescription(person)}</div>
                          </div>
                          <button
                            type="button"
                            className="icon-remove"
                            title="Remove person"
                            style={{ color: "#dc2626" }}
                            onClick={() => handleRemoveStagedPerson(person.person_id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="user-address-add-btn"
                    onClick={() => setShowPersonModal(true)}
                    disabled={!companyId}
                    title={!companyId ? "Select company first" : "Add partner"}
                  >
                    + Add Partner
                  </button>
                </div>
              )}
            </div>

            <div className="patient-data-card user-addresses-section">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isAddressesSectionOpen}
                  onClick={() => setIsAddressesSectionOpen((prev) => !prev)}
                >
                  <span>Addresses</span>
                  <span className="patient-card-chevron">{isAddressesSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isAddressesSectionOpen && (
                <div className="patient-data-card-body">
                  {addresses.length === 0 ? (
                    <p className="user-addresses-empty">No addresses added.</p>
                  ) : (
                    <div className="user-addresses-grid">
                      {addresses.map((address) => (
                        <div key={getAddressRowKey(address)} className="user-address-card">
                          <div className="user-address-card-top">
                            <strong>{address?.address_type?.description || "Address"}</strong>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <button
                                type="button"
                                className="icon-edit"
                                title="Edit address"
                                onClick={() => openEditAddressModal(address)}
                              >
                                ✏️
                              </button>
                              <FaTrash
                                className="icon-button"
                                style={{ color: "#dc2626" }}
                                onClick={() => handleRequestDeleteAddress(getAddressRowKey(address))}
                              />
                            </div>
                          </div>

                          <div className="user-address-card-body">
                            <p>{address?.street_1 || "—"}</p>
                            {address?.street_2?.trim() && <p>{address.street_2}</p>}
                            <p>
                              {address?.city || ""}
                              {address?.city && address?.st ? ", " : ""}
                              {address?.st || ""}
                              {(address?.city || address?.st) && address?.zip ? " " : ""}
                              {address?.zip || (!(address?.city || address?.st) ? "—" : "")}
                            </p>
                            <p>{address?.country || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="button" className="user-address-add-btn" onClick={openAddAddressModal}>
                    + Add Address
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="patient-data-card events-section events-section-full-width">
              <div className="collapsible-section-header patient-data-card-header-row">
                <button
                  type="button"
                  className="collapsible-section-toggle"
                  aria-expanded={isEventsSectionOpen}
                  onClick={() => setIsEventsSectionOpen((prev) => !prev)}
                >
                  <span>Injury Events</span>
                  <span className="patient-card-chevron">{isEventsSectionOpen ? "▾" : "▸"}</span>
                </button>
              </div>

              {isEventsSectionOpen && (
                <div className="patient-data-card-body">
                  {stagedEvents.length === 0 ? (
                    <div className="people-empty">No injury events added yet.</div>
                  ) : (
                    <div className="events-table-wrap">
                      <table className="events-table">
                        <colgroup>
                          <col className="events-col-event" />
                          <col className="events-col-type" />
                          <col className="events-col-date" />
                          <col className="events-col-actions" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Event Type</th>
                            <th>Event Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stagedEvents.map((eventItem, index) => (
                            <tr key={`${eventItem.event}-${eventItem.event_date}-${index}`}>
                              <td>{eventItem.event || "—"}</td>
                              <td>{getInjuryEventTypeDescription(eventItem)}</td>
                              <td>{formatEventDate(eventItem.event_date)}</td>
                              <td className="event-actions-cell">
                                <div className="event-actions">
                                  <button
                                    type="button"
                                    className="icon-edit"
                                    title="Edit injury event"
                                    onClick={() => handleOpenEditEvent(index)}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="icon-remove"
                                    title="Delete injury event"
                                    onClick={() => handleOpenDeleteEvent(index)}
                                  >
                                    <FaTrash style={{ color: "#dc2626" }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button type="button" className="user-address-add-btn" onClick={handleOpenAddEvent}>
                    + Add Injury Event
                  </button>
                </div>
              )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : `Create ${patientLabels.singular}`}
          </button>
        </div>

        {showPersonModal && (
          <PatientPersonModal
            companyId={Number(companyId)}
            linkedPersonIds={stagedPeople.map((p) => p.person_id)}
            onClose={() => setShowPersonModal(false)}
            onPersonAdded={({ person }) => {
              if (!person) {
                setShowPersonModal(false);
                return;
              }

              setStagedPeople((prev) => {
                if (prev.some((p) => p.person_id === person.person_id)) {
                  return prev;
                }
                return [...prev, person];
              });

              setShowPersonModal(false);
            }}
          />
        )}

        {showEventModal && (
          <PatientEventModal
            title={editingEventIndex !== null ? "Edit Injury Event" : "Add Injury Event"}
            initialEvent={editingEventIndex !== null ? stagedEvents[editingEventIndex] : null}
            saving={saving}
            onCancel={() => {
              if (saving) return;
              setShowEventModal(false);
              setEditingEventIndex(null);
            }}
            onSave={handleSaveStagedEvent}
            injuryEventTypes={injuryEventTypes}
          />
        )}

        {isDeleteEventOpen && deletingEventIndex !== null && (
          <ConfirmActionModal
            title="Delete Injury Event"
            message="Are you sure you want to delete this injury event?"
            confirmLabel="Yes, Delete"
            onCancel={() => {
              setIsDeleteEventOpen(false);
              setDeletingEventIndex(null);
            }}
            onConfirm={handleDeleteStagedEvent}
          />
        )}

        {showPhoneModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "520px" }}>
              <div className="modal-header">
                <h3>{editingPhoneKey !== null ? "Edit Phone" : "Add Phone"}</h3>
                <button className="icon-close" onClick={() => setShowPhoneModal(false)}>✕</button>
              </div>

              <div className="details-grid">
                <Detail label="Phone">
                  <input
                    inputMode="numeric"
                    value={formatPhoneForInput(newPhoneData.phone)}
                    onChange={(e) =>
                      setNewPhoneData((prev) => ({
                        ...prev,
                        phone: normalizePhoneDigits(e.target.value),
                      }))
                    }
                  />
                </Detail>
                <Detail label="Phone Type">
                  <select
                    value={newPhoneData.phone_type_id}
                    onChange={(e) =>
                      setNewPhoneData((prev) => ({ ...prev, phone_type_id: e.target.value }))
                    }
                  >
                    <option value="">Select Type</option>
                    {phoneTypes.map((phoneType) => (
                      <option key={phoneType.phone_type_id} value={phoneType.phone_type_id}>
                        {phoneType.description}
                      </option>
                    ))}
                  </select>
                </Detail>
              </div>

              <div className="modal-actions">
                {phoneError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{phoneError}</p>}
                <button onClick={() => setShowPhoneModal(false)}>Cancel</button>
                <button className="primary" onClick={handleSavePhoneFromModal}>
                  {editingPhoneKey !== null ? "Save Phone" : "Add Phone"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeletePhoneOpen && (
          <div className="modal-overlay" style={{ zIndex: 1350 }}>
            <div className="modal modern" style={{ width: "460px" }}>
              <div className="modal-header">
                <h3>Delete Phone</h3>
                <button
                  className="icon-close"
                  onClick={() => {
                    setIsDeletePhoneOpen(false);
                    setDeletingPhoneKey(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ marginBottom: "18px", color: "#444" }}>
                Are you sure you want to delete this phone?
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setIsDeletePhoneOpen(false);
                    setDeletingPhoneKey(null);
                  }}
                >
                  Cancel
                </button>
                <button className="primary" onClick={handleConfirmDeletePhone}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddressModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "560px" }}>
              <div className="modal-header">
                <h3>{editingAddressKey !== null ? "Edit Address" : "Add Address"}</h3>
                <button className="icon-close" onClick={() => setShowAddressModal(false)}>✕</button>
              </div>

              <div className="details-grid">
                <Detail label="Street 1">
                  <input
                    value={newAddressData.street_1}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_1: e.target.value }))}
                  />
                </Detail>
                <Detail label="Street 2">
                  <input
                    value={newAddressData.street_2}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_2: e.target.value }))}
                  />
                </Detail>
                <Detail label="City">
                  <input
                    value={newAddressData.city}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </Detail>
                <Detail label="State">
                  <select
                    value={newAddressData.st}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, st: e.target.value }))}
                  >
                    <option value="">Select State</option>
                    {US_STATES.map((stateOption) => (
                      <option key={stateOption.value} value={stateOption.value}>
                        {stateOption.label}
                      </option>
                    ))}
                  </select>
                </Detail>
                <Detail label="Zip">
                  <input
                    value={newAddressData.zip}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, zip: e.target.value }))}
                  />
                </Detail>
                <Detail label="Country">
                  <select
                    value={newAddressData.country}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, country: e.target.value }))}
                  >
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </Detail>
                <Detail label="Address Type">
                  <select
                    value={newAddressData.address_type_id}
                    onChange={(e) => setNewAddressData((prev) => ({ ...prev, address_type_id: e.target.value }))}
                  >
                    <option value="">Select Type</option>
                    {addressTypes.map((addressType) => (
                      <option key={addressType.address_type_id} value={addressType.address_type_id}>
                        {addressType.description}
                      </option>
                    ))}
                  </select>
                </Detail>
              </div>

              <div className="modal-actions">
                {addressError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{addressError}</p>}
                <button onClick={() => setShowAddressModal(false)}>Cancel</button>
                <button className="primary" onClick={handleSaveAddressFromModal}>
                  {editingAddressKey !== null ? "Save Address" : "Add Address"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteAddressOpen && (
          <div className="modal-overlay" style={{ zIndex: 1350 }}>
            <div className="modal modern" style={{ width: "460px" }}>
              <div className="modal-header">
                <h3>Delete Address</h3>
                <button
                  className="icon-close"
                  onClick={() => {
                    setIsDeleteAddressOpen(false);
                    setDeletingAddressKey(null);
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ marginBottom: "18px", color: "#444" }}>
                Are you sure you want to delete this address?
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setIsDeleteAddressOpen(false);
                    setDeletingAddressKey(null);
                  }}
                >
                  Cancel
                </button>
                <button className="primary" onClick={handleConfirmDeleteAddress}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PatientEventModal = ({
  title,
  initialEvent,
  saving,
  onCancel,
  onSave,
  injuryEventTypes = [],
}) => {
  const toDateInputValue = (value) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  };

  const [eventText, setEventText] = useState(initialEvent?.event || "");
  const [eventDate, setEventDate] = useState(toDateInputValue(initialEvent?.event_date));
  const [injuryEventTypeId, setInjuryEventTypeId] = useState(
    String(getInjuryEventTypeId(initialEvent))
  );

  useEffect(() => {
    setEventText(initialEvent?.event || "");
    setEventDate(toDateInputValue(initialEvent?.event_date));
    setInjuryEventTypeId(String(getInjuryEventTypeId(initialEvent)));
  }, [initialEvent]);

  const handleSubmit = () => {
    if (!eventText || !eventDate || !injuryEventTypeId) return;
    onSave({ event: eventText, eventDate, injuryEventTypeId });
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern event-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-close" onClick={onCancel}>✕</button>
        </div>

        <div className="details-grid">
          <Detail label="Event Date">
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </Detail>

          <Detail label="Injury Event Type">
            <select
              value={injuryEventTypeId}
              onChange={(e) => setInjuryEventTypeId(e.target.value)}
            >
              <option value="">Select Type</option>
              {injuryEventTypes.map((eventType) => (
                <option
                  key={eventType.injury_event_type_id}
                  value={eventType.injury_event_type_id}
                >
                  {eventType.description}
                </option>
              ))}
            </select>
          </Detail>

          <Detail label="Injury Event Description" style={{ gridColumn: "1 / -1" }}>
            <textarea
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              rows={4}
            />
          </Detail>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button
            className="primary"
            type="button"
            disabled={saving || !eventText || !eventDate || !injuryEventTypeId}
            onClick={handleSubmit}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmActionModal = ({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  disabled = false,
}) => (
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
      <h3 style={{ marginBottom: "12px", color: "#dc3545" }}>{title}</h3>

      <p style={{ marginBottom: "20px", color: "#444" }}>{message}</p>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button onClick={onCancel} disabled={disabled}>Cancel</button>

        <button
          style={{
            background: "#dc3545",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
          onClick={onConfirm}
          disabled={disabled}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const PatientPersonModal = ({ companyId, patientId, linkedPersonIds, onClose, onPersonAdded }) => {
  const [people, setPeople] = useState([]);
  const [personTypes, setPersonTypes] = useState([]);
  const [companyPeopleLinks, setCompanyPeopleLinks] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [personTypeId, setPersonTypeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest(PEOPLE_API).then((r) => r.json()),
      apiRequest(PERSON_TYPES_API).then((r) => r.json()),
      apiRequest(COMPANY_PEOPLE_API).then((r) => r.json()),
    ])
      .then(([peopleData, personTypeData, companyPeopleData]) => {
        setPeople(peopleData);
        setPersonTypes(personTypeData);
        setCompanyPeopleLinks(companyPeopleData);
      })
      .catch(console.error);
  }, []);

  const companyPersonIds = companyPeopleLinks
    .filter((cp) => getCompanyIdFromCompanyPerson(cp) === Number(companyId))
    .map((cp) => getPersonIdFromCompanyPerson(cp));

  const availablePeople = people.filter((person) => {
    const personId = Number(person.person_id);
    return companyPersonIds.includes(personId) && !linkedPersonIds.includes(personId);
  });

  const ensureCompanyPersonLink = async (personId) => {
    if (!companyId || !personId) return;
    if (companyPersonIds.includes(Number(personId))) return;

    await apiRequest(COMPANY_PEOPLE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        person_id: personId,
      }),
    });
  };

  const handleAddPerson = async () => {
    setSaving(true);

    try {
      let personToAdd = null;
      let personIdToUse = selectedPersonId ? Number(selectedPersonId) : null;

      if (!personIdToUse) {
        const createPersonRes = await apiRequest(PEOPLE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            person_type_id: personTypeId ? Number(personTypeId) : null,
          }),
        });

        personToAdd = await createPersonRes.json();
        personIdToUse = Number(personToAdd.person_id);
      } else {
        personToAdd = people.find((p) => Number(p.person_id) === personIdToUse) || null;
      }

      await ensureCompanyPersonLink(personIdToUse);

      if (patientId && personIdToUse) {
        await apiRequest(PATIENT_PEOPLE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            person_id: personIdToUse,
          }),
        });
      }

      if (personToAdd && personTypeId && !personToAdd.person_type) {
        const typeMatch = personTypes.find(
          (type) => Number(type.person_type_id) === Number(personTypeId)
        );
        if (typeMatch) {
          personToAdd = {
            ...personToAdd,
            person_type: typeMatch,
          };
        }
      }

      onPersonAdded({ person: personToAdd, personId: personIdToUse });
    } catch (err) {
      console.error("Add person failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern person-modal">
        <div className="modal-header">
          <h3>Partner</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="details-grid">
          <Detail label="Existing Partner">
            <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)}>
              <option value="">Select partner</option>
              {availablePeople.map((person) => (
                <option key={person.person_id} value={person.person_id}>
                  {getPersonDisplayName(person)} ({getPersonTypeDescription(person)})
                </option>
              ))}
            </select>
          </Detail>

          <Detail label="First Name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!!selectedPersonId}
            />
          </Detail>

          <Detail label="Last Name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={!!selectedPersonId}
            />
          </Detail>

          <Detail label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!selectedPersonId}
            />
          </Detail>

          <Detail label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!!selectedPersonId}
            />
          </Detail>

          <Detail label="Partner Type">
            <select
              value={personTypeId}
              onChange={(e) => setPersonTypeId(e.target.value)}
              disabled={!!selectedPersonId}
            >
              <option value="">Select type</option>
              {personTypes.map((pt) => (
                <option key={pt.person_type_id} value={pt.person_type_id}>
                  {pt.description}
                </option>
              ))}
            </select>
          </Detail>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving || !companyId} onClick={handleAddPerson}>
            {saving ? "Saving..." : "Add Partner"}
          </button>
        </div>
      </div>
    </div>
  );
};

const PatientAssessmentsModal = ({ patient, onClose }) => {
  const [attempts, setAttempts] = useState([]);
  const [attemptProgressByAttemptId, setAttemptProgressByAttemptId] = useState({});
  const [refreshingAttemptByKey, setRefreshingAttemptByKey] = useState({});
  const [linkFeedbackByAttemptKey, setLinkFeedbackByAttemptKey] = useState({});
  const [assessments, setAssessments] = useState([]);
  const [patientEvents, setPatientEvents] = useState([]);
  const [selectedPatientEventId, setSelectedPatientEventId] = useState("");
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const eventDropdownRef = useRef(null);
  const linkFeedbackTimeoutsRef = useRef({});
  const questionDetailsByIdRef = useRef({});
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [isDeleteAssessmentOpen, setIsDeleteAssessmentOpen] = useState(false);
  const [deletingAssessmentAttempt, setDeletingAssessmentAttempt] = useState(null);
  const [deletingAssessmentInProgress, setDeletingAssessmentInProgress] = useState(false);
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [selectedAnswersAttempt, setSelectedAnswersAttempt] = useState(null);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState("");
  const [answerRows, setAnswerRows] = useState([]);
  const [answerSignatures, setAnswerSignatures] = useState([]);
  const [loadingAnswersAttemptId, setLoadingAnswersAttemptId] = useState(null);

  const useClientTerminology = shouldUseClientTerminology();
  const patientLabels = getPatientLabels(useClientTerminology);
  const assessmentAppBaseUrl = useMemo(() => {
    const configuredBase = String(process.env.REACT_APP_APP_URL_BASE || "").trim();
    const fallbackBase = String(window?.location?.origin || "http://localhost:3000").trim();
    return (configuredBase || fallbackBase).replace(/\/$/, "");
  }, []);

  const buildAssessmentLink = useCallback((tokenValue) => {
    const sanitizedToken = String(tokenValue || "").trim();
    return `${assessmentAppBaseUrl}/take-assessment/${sanitizedToken}`;
  }, [assessmentAppBaseUrl]);

  const sendAssessmentLinkEmail = useCallback(async ({ recipientEmail, assessmentLink }) => {
    const trimmedRecipientEmail = String(recipientEmail || "").trim();
    if (!trimmedRecipientEmail) {
      throw new Error("Patient email is missing.");
    }

    const basePayload = {
      to_addresses: [trimmedRecipientEmail],
      subject: "Assessment Link",
      body_text:
        `Please click the assessment link below to start your assessment:\n\n${assessmentLink}`,
    };

    let response = await apiRequest(TEST_SEND_EMAIL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(basePayload),
    });

    if (response.status === 404) {
      response = await apiRequest(TEST_SEND_EMAIL_API_ALT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      });
    }

    if (response.ok) {
      return;
    }

    const apiError = await getResponseErrorMessage(response);
    const normalizedError = String(apiError || "");

    if (/MessageRejected|not verified|failed the check/i.test(normalizedError)) {
      throw new Error(
        "Send assessment email failed because SES rejected the identity. " +
          "Verify sender and recipient identities in SES for region US-WEST-2 or move the account out of SES sandbox. " +
          `API detail: ${normalizedError}`
      );
    }

    throw new Error(
      `Send assessment email failed with status ${response.status}: ${normalizedError}`
    );
  }, []);

  const getOrCreateAttemptToken = useCallback(async (attempt) => {
    const existingToken = String(
      attempt?.token ?? attempt?.patient_token ?? attempt?.assessment_token ?? ""
    ).trim();

    if (existingToken) {
      return existingToken;
    }

    const attemptId = getAttemptId(attempt);
    if (!attemptId) {
      throw new Error("Could not resolve attempt id for token generation.");
    }

    const tokenRes = await apiRequest(PATIENT_TOKENS_CREATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_assessment_attempt: attemptId,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token create failed with status ${tokenRes.status}`);
    }

    const tokenPayload = await tokenRes.json();
    const createdToken = String(tokenPayload?.token ?? tokenPayload?.value ?? "").trim();
    if (!createdToken) {
      throw new Error("Token create response did not include token value.");
    }

    return createdToken;
  }, []);

  const loadAttemptsForPatient = useCallback(async () => {
    if (!patient?.patient_id) {
      setAttempts([]);
      return [];
    }

    const attemptsRes = await apiRequest(PATIENT_ASSESSMENT_ATTEMPTS_API);
    const attemptsData = await attemptsRes.json();
    const patientAttempts = attemptsData.filter(
      (attempt) => getAttemptPatientId(attempt) === Number(patient.patient_id)
    );

    const normalizedAttempts = patientAttempts.map((attempt) => {
      const resolvedAttemptId = attempt.id ?? getAttemptId(attempt);
      return {
        ...attempt,
        patient_assessment_attempt_id:
          attempt.patient_assessment_attempt_id ?? resolvedAttemptId,
      };
    });

    setAttempts(normalizedAttempts);
    return normalizedAttempts;
  }, [patient?.patient_id]);

  const loadAssessments = useCallback(async () => {
    const assessmentsRes = await apiRequest(ASSESSMENTS_API);
    const assessmentsData = await assessmentsRes.json();
    setAssessments(assessmentsData);
  }, []);

  const loadPatientEvents = useCallback(async () => {
    if (!patient?.patient_id) {
      setPatientEvents([]);
      return;
    }

    const eventsRes = await apiRequest(PATIENT_EVENTS_API);
    const eventsData = await eventsRes.json();
    const filtered = eventsData.filter(
      (item) => getPatientIdFromPatientEvent(item) === Number(patient.patient_id)
    );
    setPatientEvents(filtered);
  }, [patient?.patient_id]);

  const assignableAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      const assessmentId = Number(assessment.assessment_id);
      const matchingAttempts = attempts.filter(
        (attempt) => getAttemptAssessmentId(attempt) === assessmentId
      );

      if (matchingAttempts.length === 0) return true;

      const hasActiveAssignment = matchingAttempts.some(
        (attempt) => {
          const status = String(getAttemptStatus(attempt) ?? "").trim().toLowerCase();
          return status === "assigned" || status === "in_progress";
        }
      );

      return !hasActiveAssignment;
    });
  }, [assessments, attempts]);

  const displayedAttempts = useMemo(() => {
    const statusOrder = {
      assigned: 1,
      in_progress: 2,
      completed: 3,
      removed: 4,
    };

    const filteredAttempts = showRemoved
      ? attempts
      : attempts.filter((attempt) => getAttemptStatus(attempt) !== "removed");

    return [...filteredAttempts].sort((left, right) => {
      const leftStatus = String(getAttemptStatus(left)).toLowerCase();
      const rightStatus = String(getAttemptStatus(right)).toLowerCase();

      const leftPriority = statusOrder[leftStatus] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = statusOrder[rightStatus] ?? Number.MAX_SAFE_INTEGER;

      return leftPriority - rightPriority;
    });
  }, [attempts, showRemoved]);

  const inProgressAttemptIds = useMemo(() => {
    const ids = attempts
      .filter((attempt) => String(getAttemptStatus(attempt)).toLowerCase() === "in_progress")
      .map((attempt) => Number(getAttemptId(attempt)))
      .filter((attemptId) => Number.isFinite(attemptId) && attemptId > 0);

    return ids.sort((left, right) => left - right);
  }, [attempts]);

  const inProgressAttemptIdsKey = useMemo(
    () => inProgressAttemptIds.join(","),
    [inProgressAttemptIds]
  );

  useEffect(() => {
    if (!inProgressAttemptIdsKey) {
      setAttemptProgressByAttemptId({});
      return;
    }

    let cancelled = false;

    const loadAttemptProgress = async () => {
      try {
        const progressRes = await apiRequest(PATIENT_ATTEMPT_PROGRESS_API);
        const progressData = await progressRes.json();

        const rows = Array.isArray(progressData)
          ? progressData
          : Array.isArray(progressData?.results)
            ? progressData.results
            : [];

        const inProgressSet = new Set(inProgressAttemptIds);
        const nextProgressByAttemptId = {};

        rows.forEach((row) => {
          const attemptId = getAttemptProgressAttemptId(row);
          if (!attemptId || !inProgressSet.has(attemptId)) return;

          const questionCount = Number(row?.question_count ?? 0);
          const currentQuestionProgress = Number(row?.current_question_progress ?? 0);

          nextProgressByAttemptId[attemptId] = {
            questionCount: Number.isFinite(questionCount) ? Math.max(0, questionCount) : 0,
            currentQuestionProgress: Number.isFinite(currentQuestionProgress)
              ? Math.max(0, currentQuestionProgress)
              : 0,
          };
        });

        if (!cancelled) {
          setAttemptProgressByAttemptId(nextProgressByAttemptId);
        }
      } catch (err) {
        console.error("Load patient attempt progress failed", err);
        if (!cancelled) {
          setAttemptProgressByAttemptId({});
        }
      }
    };

    loadAttemptProgress();

    return () => {
      cancelled = true;
    };
  }, [inProgressAttemptIds, inProgressAttemptIdsKey]);

  useEffect(() => {
    const loadData = async () => {
      if (!patient?.patient_id) return;

      setLoading(true);
      try {
        await Promise.all([
          loadAttemptsForPatient(),
          loadAssessments(),
          loadPatientEvents(),
        ]);
      } catch (err) {
        console.error("Load patient assessments failed", err);
        setAttempts([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [patient?.patient_id, loadAttemptsForPatient, loadAssessments, loadPatientEvents]);

  const formatEventOptionDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  };

  const truncateEventLabelWithEllipsis = (label) => {
    const normalized = String(label ?? "");
    return normalized.length > 100 ? `${normalized.slice(0, 100)}...` : normalized;
  };

  const getEventFullText = (eventItem, index) => {
    if (!eventItem) return "";
    const eventLabel = eventItem.event || `Event ${index + 1}`;
    const eventDate = formatEventOptionDate(eventItem.event_date);
    return eventDate ? `${eventLabel} (${eventDate})` : eventLabel;
  };

  const getEventTruncatedText = (eventItem, index) => {
    if (!eventItem) return "";
    const eventLabel = eventItem.event || `Event ${index + 1}`;
    const eventDate = formatEventOptionDate(eventItem.event_date);
    const truncatedLabel = truncateEventLabelWithEllipsis(eventLabel);
    return eventDate ? `${truncatedLabel} (${eventDate})` : truncatedLabel;
  };

  useEffect(() => {
    if (!isEventDropdownOpen) return;

    const handleOutsideClick = (event) => {
      const container = eventDropdownRef.current;
      if (!container) return;
      if (container.contains(event.target)) return;
      setIsEventDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEventDropdownOpen]);

  const getAssessmentName = (attempt) => {
    const attemptName = attempt.assessment?.name ?? attempt.assessment_name;
    if (attemptName) return attemptName;

    const assessmentId = getAttemptAssessmentId(attempt);
    const found = assessments.find((a) => Number(a.assessment_id) === assessmentId);
    return found?.name ?? `Assessment #${assessmentId || "—"}`;
  };

  const getAttemptFeedbackKey = (attempt) => {
    const attemptId = getAttemptId(attempt);
    const assessmentId = getAttemptAssessmentId(attempt);
    return `${attemptId ?? "tmp"}-${assessmentId ?? "na"}`;
  };

  const fetchAttemptProgressByAttemptId = useCallback(async (attemptId) => {
    const normalizedAttemptId = Number(attemptId);
    if (!Number.isFinite(normalizedAttemptId) || normalizedAttemptId <= 0) {
      return null;
    }

    const progressRes = await apiRequest(PATIENT_ATTEMPT_PROGRESS_API);
    const progressData = await progressRes.json();
    const rows = Array.isArray(progressData)
      ? progressData
      : Array.isArray(progressData?.results)
        ? progressData.results
        : [];

    const targetRow = rows.find(
      (row) => getAttemptProgressAttemptId(row) === normalizedAttemptId
    );

    if (!targetRow) {
      return null;
    }

    const questionCount = Number(targetRow?.question_count ?? 0);
    const currentQuestionProgress = Number(targetRow?.current_question_progress ?? 0);

    return {
      questionCount: Number.isFinite(questionCount) ? Math.max(0, questionCount) : 0,
      currentQuestionProgress: Number.isFinite(currentQuestionProgress)
        ? Math.max(0, currentQuestionProgress)
        : 0,
    };
  }, []);

  const handleRefreshAttemptCard = useCallback(async (attempt) => {
    const attemptId = Number(getAttemptId(attempt));
    if (!Number.isFinite(attemptId) || attemptId <= 0) {
      return;
    }

    const feedbackKey = getAttemptFeedbackKey(attempt);
    setRefreshingAttemptByKey((prev) => ({ ...prev, [feedbackKey]: true }));

    try {
      let refreshedAttempt = null;

      const detailRes = await apiRequest(`${PATIENT_ASSESSMENT_ATTEMPTS_API}${attemptId}/`);
      if (detailRes.ok) {
        refreshedAttempt = await detailRes.json();
      }

      if (!refreshedAttempt) {
        const listRes = await apiRequest(PATIENT_ASSESSMENT_ATTEMPTS_API);
        const listRows = await listRes.json();
        const rows = Array.isArray(listRows)
          ? listRows
          : Array.isArray(listRows?.results)
            ? listRows.results
            : [];
        refreshedAttempt = rows.find((row) => Number(getAttemptId(row)) === attemptId) || null;
      }

      if (!refreshedAttempt) {
        throw new Error(`Attempt ${attemptId} not found during card refresh.`);
      }

      const normalizedRefreshedAttempt = {
        ...refreshedAttempt,
        patient_assessment_attempt_id:
          refreshedAttempt.patient_assessment_attempt_id ?? getAttemptId(refreshedAttempt) ?? attemptId,
      };

      setAttempts((prev) =>
        prev.map((row) =>
          Number(getAttemptId(row)) === attemptId
            ? {
                ...row,
                ...normalizedRefreshedAttempt,
              }
            : row
        )
      );

      const refreshedStatus = String(getAttemptStatus(normalizedRefreshedAttempt)).toLowerCase();
      if (refreshedStatus === "in_progress") {
        const progressSnapshot = await fetchAttemptProgressByAttemptId(attemptId);
        setAttemptProgressByAttemptId((prev) => ({
          ...prev,
          [attemptId]: progressSnapshot || {
            questionCount: 0,
            currentQuestionProgress: 0,
          },
        }));
      } else {
        setAttemptProgressByAttemptId((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev, attemptId)) {
            return prev;
          }
          const next = { ...prev };
          delete next[attemptId];
          return next;
        });
      }
    } catch (error) {
      console.error("Refresh patient assessment card failed", error);
    } finally {
      setRefreshingAttemptByKey((prev) => {
        const next = { ...prev };
        delete next[feedbackKey];
        return next;
      });
    }
  }, [fetchAttemptProgressByAttemptId]);

  const fetchResponsesForAttempt = useCallback(async (attemptId) => {
    const normalizedAttemptId = Number(attemptId);
    if (!Number.isFinite(normalizedAttemptId) || normalizedAttemptId <= 0) {
      return [];
    }

    const responseQueryPaths = [
      `${PATIENT_RESPONSES_HISTORY_API}?assessment_attempt_id=${normalizedAttemptId}`,
      `${PATIENT_RESPONSES_API}?attempt_id=${normalizedAttemptId}`,
      `${PATIENT_RESPONSES_API}?assessment_attempt_id=${normalizedAttemptId}`,
      `${PATIENT_RESPONSES_API}?attempt=${normalizedAttemptId}`,
      `${PATIENT_RESPONSES_API}?patient_assessment_attempt_id=${normalizedAttemptId}`,
    ];

    for (const responsePath of responseQueryPaths) {
      try {
        const response = await apiRequest(responsePath);
        if (!response.ok) continue;

        const payload = await response.json();
        const rows = normalizeApiRows(payload);
        const matchingRows = rows.filter(
          (responseItem) => getResponseAttemptId(responseItem) === normalizedAttemptId
        );
        const rowsWithKnownAttemptIds = rows.filter(
          (responseItem) => getResponseAttemptId(responseItem) > 0
        );
        const hasMismatchedAttemptIds = rowsWithKnownAttemptIds.some(
          (responseItem) => getResponseAttemptId(responseItem) !== normalizedAttemptId
        );

        if (matchingRows.length > 0) {
          return matchingRows;
        }

        if (rows.length > 0 && !hasMismatchedAttemptIds) {
          return rows;
        }
      } catch {
        // Try the next endpoint variant.
      }
    }

    const fallbackResponse = await apiRequest(PATIENT_RESPONSES_API);
    const fallbackPayload = await fallbackResponse.json();
    return normalizeApiRows(fallbackPayload).filter(
      (responseItem) => getResponseAttemptId(responseItem) === normalizedAttemptId
    );
  }, []);

  const fetchQuestionDetailsByIds = useCallback(async (questionIds) => {
    const uniqueIds = Array.from(
      new Set(
        (questionIds || [])
          .map((questionId) => Number(questionId))
          .filter((questionId) => Number.isFinite(questionId) && questionId > 0)
      )
    );

    await Promise.all(uniqueIds.map(async (questionId) => {
      if (questionDetailsByIdRef.current[questionId]) return;

      try {
        const response = await apiRequest(`${QUESTIONS_API}${questionId}/`);
        if (!response.ok) return;
        const questionPayload = await response.json();
        questionDetailsByIdRef.current[questionId] = questionPayload;
      } catch {
        // Fall back to the numeric id if question details cannot be resolved.
      }
    }));
  }, []);

  const handleViewAnswers = useCallback(async (attempt) => {
    const attemptId = Number(getAttemptId(attempt));
    if (!Number.isFinite(attemptId) || attemptId <= 0) {
      return;
    }

    setShowAnswersModal(true);
    setSelectedAnswersAttempt(attempt);
    setAnswersLoading(true);
    setAnswersError("");
    setAnswerRows([]);
    setAnswerSignatures([]);
    setLoadingAnswersAttemptId(attemptId);

    try {
      const responses = await fetchResponsesForAttempt(attemptId);

      responses.forEach((responseItem) => {
        const questionId = getResponseQuestionId(responseItem);
        const embeddedQuestion = responseItem?.question;
        if (questionId && embeddedQuestion && typeof embeddedQuestion === "object") {
          questionDetailsByIdRef.current[questionId] = embeddedQuestion;
        }
      });

      await fetchQuestionDetailsByIds(
        responses.map((responseItem) => getResponseQuestionId(responseItem))
      );

      const nextRows = [];
      const nextSignatures = [];

      responses.forEach((responseItem, index) => {
        const questionId = getResponseQuestionId(responseItem);
        const questionData =
          questionDetailsByIdRef.current[questionId] ?? responseItem?.question ?? null;
        const questionText =
          String(questionData?.question ?? responseItem?.question?.question ?? "").trim() ||
          `Question #${questionId || index + 1}`;
        const questionTypeDescription = getQuestionTypeDescription(questionData);
        const resolvedAnswerValue = normalizeStoredAnswerValue(
          responseItem?.answer_value ??
            responseItem?.answerValue ??
            responseItem?.response_value ??
            responseItem?.responseValue ??
            responseItem?.answer ??
            null
        );

        if (
          questionTypeDescription === "signature_agreement" &&
          resolvedAnswerValue &&
          typeof resolvedAnswerValue === "object" &&
          !Array.isArray(resolvedAnswerValue)
        ) {
          Object.entries(resolvedAnswerValue).forEach(([key, value]) => {
            if (key === "signature_data_url") {
              const signatureUrl = String(value ?? "").trim();
              if (signatureUrl) {
                nextSignatures.push({
                  key: `${questionId}-signature`,
                  question: questionText,
                  signatureUrl,
                });
              }
              return;
            }

            if (isBlankAnswerValue(value)) {
              return;
            }

            nextRows.push({
              key: `${questionId}-${key}`,
              question: `${questionText} - ${formatAnswerKeyLabel(key)}`,
              answer: formatAnswerValueForTable(value),
            });
          });
          return;
        }

        if (isBlankAnswerValue(resolvedAnswerValue)) {
          return;
        }

        nextRows.push({
          key: `${questionId || index}-answer`,
          question: questionText,
          answer: formatAnswerValueForTable(resolvedAnswerValue),
        });
      });

      setAnswerRows(nextRows);
      setAnswerSignatures(nextSignatures);
    } catch (error) {
      console.error("Load assessment answers failed", error);
      setAnswersError(error?.message || "Failed to load assessment answers.");
      setAnswerRows([]);
      setAnswerSignatures([]);
    } finally {
      setAnswersLoading(false);
      setLoadingAnswersAttemptId(null);
    }
  }, [fetchQuestionDetailsByIds, fetchResponsesForAttempt]);

  const showLinkFeedback = useCallback((attempt, message) => {
    const feedbackKey = getAttemptFeedbackKey(attempt);
    setLinkFeedbackByAttemptKey((prev) => ({
      ...prev,
      [feedbackKey]: message,
    }));

    const existingTimeout = linkFeedbackTimeoutsRef.current[feedbackKey];
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    linkFeedbackTimeoutsRef.current[feedbackKey] = window.setTimeout(() => {
      setLinkFeedbackByAttemptKey((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, feedbackKey)) {
          return prev;
        }

        const next = { ...prev };
        delete next[feedbackKey];
        return next;
      });
      delete linkFeedbackTimeoutsRef.current[feedbackKey];
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(linkFeedbackTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      linkFeedbackTimeoutsRef.current = {};
    };
  }, []);

  const handleSendLink = useCallback(async (attempt) => {
    const status = getAttemptStatus(attempt);
    if (status === "removed" || status === "completed") return;

    try {
      const tokenValue = await getOrCreateAttemptToken(attempt);
      const assessmentLink = buildAssessmentLink(tokenValue);

      console.log(
        `[PatientAssessmentsModal] patient assessment link is (${assessmentLink})`
      );

      await sendAssessmentLinkEmail({
        recipientEmail: patient?.email,
        assessmentLink,
      });
      showLinkFeedback(attempt, "Success! Link sent");
    } catch (err) {
      console.error("Send assessment link failed", err);
    }
  }, [
    buildAssessmentLink,
    getOrCreateAttemptToken,
    patient?.email,
    sendAssessmentLinkEmail,
    showLinkFeedback,
  ]);

  const handleDisableAssessment = async (attempt) => {
    let attemptId =
      attempt?.patient_assessment_attempt_id ?? getAttemptId(attempt);

    console.log("Removed Assessment");

    if (!attemptId) {
      try {
        const latestAttempts = await loadAttemptsForPatient();
        const activeMatch = latestAttempts.find(
          (a) =>
            getAttemptAssessmentId(a) === getAttemptAssessmentId(attempt) &&
            getAttemptStatus(a) !== "removed"
        );
        attemptId =
          activeMatch?.patient_assessment_attempt_id ?? getAttemptId(activeMatch);
      } catch (resolveErr) {
        console.error("Could not resolve attempt id for remove action", resolveErr);
      }
    }

    if (!attemptId) {
      console.error("Could not resolve attempt id for remove action", attempt);
      return;
    }

    setAttempts((prev) =>
      prev.map((a) =>
        getAttemptId(a) === attemptId ? { ...a, status: "removed" } : a
      )
    );

    try {
      const endpoint = `${PATIENT_ASSESSMENT_ATTEMPTS_API}${attemptId}/`;
      const patientId = getAttemptPatientId(attempt);
      const assessmentId = getAttemptAssessmentId(attempt);

      const getErrorBody = async (response) => {
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

      const inferStatusField = (errorBody) => {
        if (errorBody && Object.prototype.hasOwnProperty.call(errorBody, "attempt_status")) {
          return "attempt_status";
        }
        if (errorBody && Object.prototype.hasOwnProperty.call(errorBody, "status")) {
          return "status";
        }
        return Object.prototype.hasOwnProperty.call(attempt, "attempt_status")
          ? "attempt_status"
          : "status";
      };

      const buildPayload = ({ statusField, includePatientKey, includeAssessmentKey }) => {
        const payload = { [statusField]: "removed" };

        if (includePatientKey === "patient") payload.patient = patientId;
        if (includePatientKey === "patient_id") payload.patient_id = patientId;

        if (includeAssessmentKey === "assessment") payload.assessment = assessmentId;
        if (includeAssessmentKey === "assessment_id") payload.assessment_id = assessmentId;

        if (attempt.final_score !== undefined) {
          payload.final_score = attempt.final_score;
        }

        return payload;
      };

      let statusField = Object.prototype.hasOwnProperty.call(attempt, "attempt_status")
        ? "attempt_status"
        : "status";

      let response = await apiRequest(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload({ statusField })),
      });

      if (!response.ok) {
        const errorBody = await getErrorBody(response);
        statusField = inferStatusField(errorBody);

        const needsPatient = Object.prototype.hasOwnProperty.call(errorBody, "patient")
          ? "patient"
          : Object.prototype.hasOwnProperty.call(errorBody, "patient_id")
            ? "patient_id"
            : undefined;

        const needsAssessment = Object.prototype.hasOwnProperty.call(errorBody, "assessment")
          ? "assessment"
          : Object.prototype.hasOwnProperty.call(errorBody, "assessment_id")
            ? "assessment_id"
            : undefined;

        response = await apiRequest(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPayload({
              statusField,
              includePatientKey: needsPatient,
              includeAssessmentKey: needsAssessment,
            })
          ),
        });

        if (!response.ok) {
          response = await apiRequest(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              buildPayload({
                statusField,
                includePatientKey: needsPatient || "patient_id",
                includeAssessmentKey: needsAssessment || "assessment_id",
              })
            ),
          });

          if (!response.ok) {
            const finalErrorBody = await getErrorBody(response);
            throw new Error(
              `Disable failed with status ${response.status}: ${JSON.stringify(finalErrorBody)}`
            );
          }
        }
      }

      if (!response.ok) {
        throw new Error(`Disable failed with status ${response.status}`);
      }

      const updatedAttempt = await response.json();
      setAttempts((prev) =>
        prev.map((a) =>
          getAttemptId(a) === attemptId
            ? { ...a, ...updatedAttempt, status: "removed" }
            : a
        )
      );
      await loadAttemptsForPatient();
    } catch (err) {
      console.error("Disable assessment failed", err);
      await loadAttemptsForPatient();
    }
  };

  const handleAssignAssessment = async () => {
    if (!selectedAssessmentId || !selectedPatientEventId) return;

    setAssigning(true);
    try {
      const payload = {
        patient_id: patient.patient_id,
        assessment_id: Number(selectedAssessmentId),
        status: "assigned",
        patient_event_id: Number(selectedPatientEventId),
      };

      const response = await apiRequest(PATIENT_ASSESSMENT_ATTEMPTS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Assign failed with status ${response.status}`);
      }

      const createdAttempt = await response.json();
      const createdAttemptId =
        getAttemptId(createdAttempt) ??
        createdAttempt?.patient_assessment_attempt_id ??
        createdAttempt?.id ??
        null;

      if (createdAttemptId) {
        try {
          await handleSendLink({
            ...createdAttempt,
            patient_assessment_attempt_id: createdAttemptId,
            status: createdAttempt?.status ?? "assigned",
          });
        } catch (sendErr) {
          console.error("Assign assessment link/email failed", sendErr);
        }
      } else {
        console.warn(
          "[PatientAssessmentsModal] Could not resolve patient_assessment_attempt_id from assign response",
          createdAttempt
        );
      }

      await loadAttemptsForPatient();

      setSelectedAssessmentId("");
      setSelectedPatientEventId("");
    } catch (err) {
      console.error("Assign assessment failed", err);
    } finally {
      setAssigning(false);
    }
  };

  const handleCloseModal = () => {
    onClose();
  };

  const patientName = `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim();
  const selectedEventNumericId = Number(selectedPatientEventId);
  const selectedEvent = patientEvents.find(
    (eventItem) => Number(getPatientEventId(eventItem)) === selectedEventNumericId
  );
  const selectedEventDisplayText = selectedEvent
    ? getEventFullText(selectedEvent, 0)
    : "No Event";

  return (
    <div className="modal-overlay">
      <div className="modal modern patient-assessments-modal">
        <div className="modal-header">
          <h3>{patientName || patientLabels.singular} - Assessments</h3>
          <button className="icon-close" onClick={handleCloseModal}>✕</button>
        </div>

        <div className="assessment-event-row">
          <div className="assessment-dropdown-label">Associated Injury Event</div>
          <div className="assessment-event-dropdown" ref={eventDropdownRef}>
            <button
              type="button"
              className="assessment-event-dropdown-trigger"
              onClick={() => setIsEventDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isEventDropdownOpen}
            >
              <span className="assessment-event-dropdown-value">
                {selectedEventDisplayText}
              </span>
              <span className="assessment-event-dropdown-caret" aria-hidden="true">▾</span>
            </button>

            {isEventDropdownOpen && (
              <div className="assessment-event-dropdown-menu" role="listbox">
                <button
                  type="button"
                  className="assessment-event-dropdown-option"
                  onClick={() => {
                    setSelectedPatientEventId("");
                    setIsEventDropdownOpen(false);
                  }}
                >
                  No Event
                </button>

                {patientEvents.map((eventItem, index) => {
                  const eventId = getPatientEventId(eventItem);
                  if (!eventId) return null;
                  const truncatedText = getEventTruncatedText(eventItem, index);
                  const fullText = getEventFullText(eventItem, index);

                  return (
                    <button
                      key={eventId}
                      type="button"
                      className="assessment-event-dropdown-option"
                      title={fullText}
                      onClick={() => {
                        setSelectedPatientEventId(String(eventId));
                        setIsEventDropdownOpen(false);
                      }}
                    >
                      {truncatedText}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="assessment-assign-row">
          <div className="assessment-dropdown-label">Assessments</div>
          <select
            value={selectedAssessmentId}
            onChange={(e) => setSelectedAssessmentId(e.target.value)}
          >
            <option value="">Select assessment</option>
            {assignableAssessments.map((assessment) => (
              <option key={assessment.assessment_id} value={assessment.assessment_id}>
                {assessment.name}
              </option>
            ))}
          </select>
          <button
            className="primary"
            type="button"
            disabled={assigning || !selectedAssessmentId || !selectedPatientEventId}
            onClick={handleAssignAssessment}
          >
            {assigning ? "Assigning..." : `Assign to ${patientLabels.singular}`}
          </button>
        </div>

        <div className="assessment-filters-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(e) => setShowRemoved(e.target.checked)}
            />
            Show Removed
          </label>
        </div>

        {loading ? (
          <div className="assessment-cards-wrap" aria-live="polite" aria-busy="true">
            <div className="assessment-cards assessment-cards-skeleton">
              {[1, 2, 3].map((slot) => (
                <div className="assessment-card assessment-card-skeleton" key={`assessment-skeleton-${slot}`}>
                  <div className="skeleton-line skeleton-title" />

                  <div className="assessment-card-meta">
                    <div className="skeleton-line skeleton-badge" />
                    <div className="skeleton-line skeleton-progress" />
                  </div>

                  <div className="assessment-card-footer">
                    <div className="skeleton-line skeleton-event" />
                    <div className="assessment-card-actions">
                      <div className="skeleton-line skeleton-action" />
                      <div className="skeleton-line skeleton-action" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="assessment-cards-wrap">
            {displayedAttempts.length === 0 ? (
              <div className="people-empty">No assessments assigned.</div>
            ) : (
              <div className="assessment-cards">
                {displayedAttempts.map((attempt) => {
                  const status = getAttemptStatus(attempt);
                  const statusKey = String(status).toLowerCase();
                  const isDisabledForActions =
                    status === "removed" || status === "completed";
                  const attemptId = getAttemptId(attempt);
                  const attemptFeedbackKey = getAttemptFeedbackKey(attempt);
                  const isRefreshingCard = Boolean(refreshingAttemptByKey[attemptFeedbackKey]);
                  const linkFeedbackMessage = linkFeedbackByAttemptKey[attemptFeedbackKey];
                  const attemptProgress =
                    statusKey === "in_progress" && attemptId
                      ? attemptProgressByAttemptId[Number(attemptId)]
                      : null;
                  const progressMax = Math.max(1, Number(attemptProgress?.questionCount ?? 0));
                  const progressValue = Math.min(
                    progressMax,
                    Math.max(0, Number(attemptProgress?.currentQuestionProgress ?? 0))
                  );
                  const progressPercent = Math.round((progressValue / progressMax) * 100);
                  const score = getAttemptFinalScore(attempt);
                  const patientEventId = getAttemptPatientEventId(attempt);
                  const matchedEvent = patientEvents.find(
                    (eventItem) => Number(getPatientEventId(eventItem)) === patientEventId
                  );
                  const eventText =
                    attempt.patient_event?.event ??
                    matchedEvent?.event ??
                    "No Event";
                  const isCompleted = String(status).toLowerCase() === "completed";
                  const finalScore = formatFinalScoreForDisplay(score);

                  return (
                    <div
                      className="assessment-card"
                      key={`${attemptId ?? "tmp"}-${getAttemptAssessmentId(attempt)}`}
                    >
                      <div className="assessment-card-header">
                        <div className="assessment-card-title">{getAssessmentName(attempt)}</div>
                        {!isDisabledForActions && (
                          <button
                            type="button"
                            className="assessment-card-refresh-btn"
                            title="Refresh this assessment"
                            aria-label="Refresh this assessment"
                            onClick={() => handleRefreshAttemptCard(attempt)}
                            disabled={isRefreshingCard || !attemptId}
                          >
                            <FaSyncAlt className={isRefreshingCard ? "spin" : ""} />
                          </button>
                        )}
                      </div>

                      <div className="assessment-card-meta">
                        <div className="assessment-status-row">
                          <strong>Status:</strong>{" "}
                          <span
                            className={`assessment-status-badge ${statusKey}`}
                          >
                            {status}
                          </span>
                          {statusKey === "in_progress" && (
                            <span className="assessment-progress-inline">
                              <progress value={progressValue} max={progressMax} />
                              <span className="assessment-progress-text">
                                {progressPercent}% Completed
                              </span>
                            </span>
                          )}
                        </div>
                        {isCompleted && (
                          <div><strong>Final Score:</strong> {finalScore}</div>
                        )}
                      </div>

                      <div className="assessment-card-footer">
                        <div className="assessment-card-event">
                          <strong>Associated Event:</strong> {eventText}
                        </div>

                        <div
                          className="assessment-card-actions"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "4px",
                            marginLeft: "auto",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              className="assessments-action-btn"
                              disabled={!isCompleted || loadingAnswersAttemptId === attemptId}
                              onClick={() => handleViewAnswers(attempt)}
                            >
                              {loadingAnswersAttemptId === attemptId ? "Loading..." : "View Answers"}
                            </button>
                            <button
                              type="button"
                              className="assessments-action-btn"
                              disabled={isDisabledForActions}
                              onClick={() => {
                                handleSendLink(attempt);
                              }}
                            >
                              Resend Link
                            </button>
                            <button
                              type="button"
                              className="remove-assessment-btn"
                              title="Remove assessment"
                              disabled={isDisabledForActions}
                              onClick={() => {
                                setDeletingAssessmentAttempt(attempt);
                                setIsDeleteAssessmentOpen(true);
                              }}
                            >
                              Remove Assessment
                            </button>
                          </div>

                          {linkFeedbackMessage && (
                            <div
                              role="status"
                              aria-live="polite"
                              style={{
                                fontSize: "0.85rem",
                                color: "#166534",
                              }}
                            >
                              {linkFeedbackMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={handleCloseModal}>Close</button>
        </div>

        {showAnswersModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern patient-answers-modal">
              <div className="modal-header">
                <div className="patient-answers-modal-title-row">
                  <h3>
                    {`${getAssessmentName(selectedAnswersAttempt)} - ${`${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || patient?.email || "Patient"}`}
                  </h3>
                  <div className="patient-answers-score-pill-wrap">
                    <span className="patient-answers-score-label">Total Score</span>
                    <span className="patient-answers-score-pill">
                      {formatFinalScoreForDisplay(getAttemptFinalScore(selectedAnswersAttempt))}
                    </span>
                  </div>
                </div>
                <button className="icon-close" onClick={() => setShowAnswersModal(false)}>✕</button>
              </div>

              <div className="patient-answers-modal-body">
                {answersLoading ? (
                  <div className="patient-answers-table-wrap patient-answers-table-skeleton-wrap" aria-hidden="true">
                    <table className="patient-answers-table">
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Answer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5].map((row) => (
                          <tr key={`answer-skeleton-${row}`}>
                            <td>
                              <div className="skeleton-line patient-answers-skeleton-question" />
                            </td>
                            <td>
                              <div className="skeleton-line patient-answers-skeleton-answer" />
                              <div className="skeleton-line patient-answers-skeleton-answer short" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : answersError ? (
                  <div className="api-debug-error">{answersError}</div>
                ) : answerRows.length === 0 && answerSignatures.length === 0 ? (
                  <div className="people-empty">No answers found for this assessment.</div>
                ) : (
                  <>
                    <div className="patient-answers-table-wrap">
                      <table className="patient-answers-table">
                        <thead>
                          <tr>
                            <th>Question</th>
                            <th>Answer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {answerRows.map((row) => (
                            <tr key={row.key}>
                              <td>{row.question}</td>
                              <td>{renderAnswerContent(row.answer)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {answerSignatures.length > 0 && (
                      <div className="patient-answers-signatures-section">
                        <div className="patient-answers-signatures-title">Signature</div>
                        <div className="patient-answers-signatures-grid">
                          {answerSignatures.map((signatureItem) => (
                            <div key={signatureItem.key} className="patient-answers-signature-card">
                              <div className="patient-answers-signature-question">
                                {signatureItem.question}
                              </div>
                              <div className="patient-answers-signature-box">
                                <img
                                  src={signatureItem.signatureUrl}
                                  alt={`${signatureItem.question} signature`}
                                  className="patient-answers-signature-image"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowAnswersModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {isDeleteAssessmentOpen && deletingAssessmentAttempt && (
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
                Remove Assessment
              </h3>

              <p style={{ marginBottom: "20px", color: "#444" }}>
                Are you sure you want to remove this assessment from this {patientLabels.singularLower}?
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  disabled={deletingAssessmentInProgress}
                  onClick={() => {
                    if (deletingAssessmentInProgress) return;
                    setIsDeleteAssessmentOpen(false);
                    setDeletingAssessmentAttempt(null);
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
                    cursor: deletingAssessmentInProgress ? "not-allowed" : "pointer",
                    opacity: deletingAssessmentInProgress ? 0.7 : 1,
                  }}
                  disabled={deletingAssessmentInProgress}
                  onClick={async () => {
                    if (deletingAssessmentInProgress) return;
                    setDeletingAssessmentInProgress(true);
                    try {
                      await handleDisableAssessment(deletingAssessmentAttempt);
                    } finally {
                      setDeletingAssessmentInProgress(false);
                      setIsDeleteAssessmentOpen(false);
                      setDeletingAssessmentAttempt(null);
                    }
                  }}
                >
                  {deletingAssessmentInProgress ? "Removing..." : "Yes, Remove"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};



/* ----------------------------------
   Reusable Detail Row
---------------------------------- */

const Detail = ({ label, children, className = "", style = undefined }) => (
  <div className={`detail-row ${className}`.trim()} style={style}>
    <div className="detail-label">{label}</div>
    <div className="detail-value">{children}</div>
  </div>
);

