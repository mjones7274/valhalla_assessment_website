import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaEdit } from "react-icons/fa";
import { useOutletContext } from "react-router-dom";
import { apiRequest } from "../api";
import "./Companies.css";

const API_BASE = process.env.REACT_APP_API_URL_BASE;
const API_URL = `${API_BASE}/api/companies/`;
const COMPANY_TYPES_API = `${API_BASE}/api/company-types/`;
const COMPANY_PEOPLE_API = `${API_BASE}/api/company-people/`;
const PEOPLE_API = `${API_BASE}/api/people/`;
const PERSON_TYPES_API = `${API_BASE}/api/person-types/`;
const COMPANY_LOGO_UPLOAD_API = `${API_BASE}/api/uploads/company-logo`;
const COMPANY_LOGO_API_BASE = `${API_BASE}/api/company/logo/`;
const API_DEBUG_API = `${API_BASE}/api/api-debug/`;

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

const readErrorMessage = async (response, fallbackMessage) => {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (typeof payload === "string" && payload.trim()) {
        return payload;
      }
      if (payload?.detail) {
        return String(payload.detail);
      }
      if (payload?.message) {
        return String(payload.message);
      }
      const firstKey = Object.keys(payload || {})[0];
      if (firstKey) {
        const value = payload[firstKey];
        if (Array.isArray(value) && value.length > 0) {
          return String(value[0]);
        }
        if (value !== undefined && value !== null && String(value).trim()) {
          return `${firstKey}: ${String(value)}`;
        }
      }
    }

    const text = await response.text();
    if (text?.trim()) {
      return text.trim();
    }
  } catch {
    // Swallow parse errors and use fallback message.
  }

  return fallbackMessage;
};

const requestCompanyLogoUpload = async ({ fileName, contentType, companyId }) => {
  const response = await apiRequest(COMPANY_LOGO_UPLOAD_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: fileName,
      content_type: contentType,
      company_id: companyId,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Logo upload target request failed with status ${response.status}`
    );
    throw new Error(message);
  }

  const payload = await response.json();
  if (!payload?.upload_url) {
    throw new Error("Upload API did not return upload_url.");
  }

  return payload;
};

const uploadFileToPresignedUrl = async ({ uploadUrl, file, contentType }) => {
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Logo file upload failed with status ${response.status}`);
    }
  } catch (error) {
    const message = String(error?.message || "");
    if (error instanceof TypeError || /Failed to fetch/i.test(message)) {
      throw new Error(
        "Logo upload was blocked by S3 CORS policy. Configure the S3 bucket to allow OPTIONS and PUT from http://localhost:3000, including the Content-Type header."
      );
    }

    throw error;
  }
};

const fetchCompanyLogoUrl = async (companyId) => {
  const response = await apiRequest(`${COMPANY_LOGO_API_BASE}${companyId}`);
  if (!response.ok) {
    throw new Error(`Logo retrieval failed with status ${response.status}`);
  }

  const payload = await response.json();
  return String(payload?.logo_url || "").trim();
};

const getCompanyIdFromCompanyPerson = (cp) => {
  return Number(
    cp.company_id ?? cp.company?.company_id ?? cp.company?.id ?? 0
  );
};

const getPersonFromCompanyPerson = (cp) => {
  return cp.person ?? cp.people ?? cp.person_data ?? cp;
};

const getPersonIdFromCompanyPerson = (cp) => {
  const person = getPersonFromCompanyPerson(cp);
  return Number(cp.person_id ?? person?.person_id ?? person?.id ?? 0);
};

const getCompanyPersonId = (cp) => {
  return (
    cp.company_person_id ??
    cp.company_people_id ??
    cp.company_person?.company_person_id ??
    null
  );
};

const getPersonTypeDescription = (person) => {
  return (
    person?.person_type?.description ??
    person?.person_type_description ??
    person?.person_type_name ??
    "—"
  );
};

const getPersonDisplayName = (person) => {
  const first = person?.first_name ?? "";
  const last = person?.last_name ?? "";
  return `${first} ${last}`.trim() || person?.email || "—";
};

const normalizePhoneForStorage = (value) => String(value || "").replace(/\D/g, "");

const formatPhoneForDisplay = (value) => {
  const digits = normalizePhoneForStorage(value);
  if (!digits) return "";

  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  const extra = digits.slice(10);

  if (digits.length <= 3) return area;
  if (digits.length <= 6) return `(${area}) ${prefix}`;

  let formatted = `(${area}) ${prefix}-${line}`;
  if (extra) {
    formatted += ` ${extra}`;
  }

  return formatted;
};

const getCompanyTypeDescription = (company) => {
  return (
    company?.company_type?.description ??
    company?.company_type_description ??
    "—"
  );
};

const Companies = () => {
  const { user } = useOutletContext() || {};
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("company_id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [modalMode, setModalMode] = useState(null); // "view" | "edit"

  useEffect(() => {
    apiRequest(API_URL)
      .then((res) => res.json())
      .then(setCompanies)
      .catch(console.error);
  }, []);

  /* ----------------------------------
     Helpers
  ---------------------------------- */

  const matchesSearch = useCallback((c) => {
    const searchText = search.toLowerCase();
    return (
      c.company_id.toString().includes(searchText) ||
      c.company_name.toLowerCase().includes(searchText) ||
      c.contact_name.toLowerCase().includes(searchText) ||
      c.contact_email.toLowerCase().includes(searchText) ||
      c.created_on.toLowerCase().includes(searchText)
    );
  }, [search]);

  const sortedCompanies = useMemo(() => {
    return [...companies]
      .filter(matchesSearch)
      .sort((a, b) => {
        let valA;
        let valB;
        switch (sortField) {
          case "company_type":
            valA = getCompanyTypeDescription(a);
            valB = getCompanyTypeDescription(b);
            break;
          default:
            valA = a[sortField];
            valB = b[sortField];
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [companies, sortField, sortDirection, matchesSearch]);

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
    <div className="companies-page">
      <h1>Companies</h1>
        <div className="companies-toolbar">
            <input
                className="search-bar"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      <div className="companies-actions">
        <button
          className="primary"
          style={{ marginBottom: "12px" }}
          onClick={() => {
            setSelectedCompany(null);
            setModalMode("add");
          }}
          >
          + Add New Company
        </button>
      </div>

      <table className="companies-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort("company_id")}>ID</th>
            <th onClick={() => toggleSort("company_name")}>Company Name</th>
            <th onClick={() => toggleSort("company_type")}>Company Type</th>
            <th onClick={() => toggleSort("is_active")}>Status</th>
            <th onClick={() => toggleSort("created_on")}>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedCompanies.map((c) => (
            <tr
              key={c.company_id}
              onClick={() => {
                setSelectedCompany(c);
                setModalMode("view");
              }}
              style={{ cursor: "pointer" }}
            >
              <td>{c.company_id}</td>
              <td>{c.company_name}</td>
              <td>{getCompanyTypeDescription(c)}</td>
              <td>
                <span className={`status-pill ${c.is_active ? "active" : "inactive"}`}>
                  {c.is_active ? "Active" : "Not Active"}
                </span>
              </td>
              <td>{new Date(c.created_on).toLocaleDateString()}</td>
              <td className="actions">
                <button
                  title="View Details"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCompany(c);
                    setModalMode("view");
                  }}
                >
                  👁
                </button>
                <button
                  title="Edit Company"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCompany(c);
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
            <AddCompanyModal
            onClose={() => setModalMode(null)}
            onCreated={(newCompany) => {
                setCompanies((prev) => [...prev, newCompany]);
                setModalMode(null);
            }}
            />
        ) : (
            <CompanyModal
            company={selectedCompany}
            mode={modalMode}
            userTypeId={getUserTypeId(user)}
            onClose={() => setModalMode(null)}
            onUpdated={(updatedCompany) => {
              setCompanies((prev) =>
                prev.map((c) =>
                  c.company_id === updatedCompany.company_id ? updatedCompany : c
                )
              );
              setSelectedCompany(updatedCompany);
              setModalMode(null);
            }}
            />
        )
        )}
    </div>
  );
};

export default Companies;

/* ----------------------------------
   Modal Component
---------------------------------- */

const CompanyModal = ({ company, mode, userTypeId, onClose, onUpdated }) => {
  const isEdit = mode === "edit";
  const isCorporateAdmin = Number(userTypeId) === 3;

  const [companyName, setCompanyName] = useState(company?.company_name || "");
  const [contactName, setContactName] = useState(company?.contact_name || "");
  const [contactEmail, setContactEmail] = useState(company?.contact_email || "");
  const [isActive, setIsActive] = useState(
    company ? company.is_active : false
  );
  const [apiTestMode, setApiTestMode] = useState(Boolean(company?.api_test_mode));
  const [apiTestEmail, setApiTestEmail] = useState(company?.api_test_email || "");
  const [companyTypeId, setCompanyTypeId] = useState(
    company?.company_type?.company_type_id || ""
  );
  const [logoUrl, setLogoUrl] = useState(company?.logo_url || "");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(company?.logo_url || "");
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [draftLogoFile, setDraftLogoFile] = useState(null);
  const [draftLogoPreviewUrl, setDraftLogoPreviewUrl] = useState("");
  const [logoModalError, setLogoModalError] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [companyTypes, setCompanyTypes] = useState([]);
  const [companyPeople, setCompanyPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showApiDebugModal, setShowApiDebugModal] = useState(false);
  const [apiDebugRows, setApiDebugRows] = useState([]);
  const [apiDebugSortField, setApiDebugSortField] = useState("timestamp");
  const [apiDebugSortDirection, setApiDebugSortDirection] = useState("desc");
  const [apiDebugLoading, setApiDebugLoading] = useState(false);
  const [apiDebugError, setApiDebugError] = useState("");
  const [selectedApiDebugRow, setSelectedApiDebugRow] = useState(null);
  const [removingLinkId, setRemovingLinkId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Optional: keep state in sync if a different company is opened
  useEffect(() => {
    if (company) {
      setCompanyName(company.company_name || "");
      setContactName(company.contact_name || "");
      setContactEmail(company.contact_email || "");
      setIsActive(company.is_active);
      setApiTestMode(Boolean(company.api_test_mode));
      setApiTestEmail(company.api_test_email || "");
      setCompanyTypeId(company.company_type?.company_type_id || "");
      setLogoUrl(company.logo_url || "");
      setLogoPreviewUrl(company.logo_url || "");
      setPendingLogoFile(null);
      setLogoLoadFailed(false);
      setSaveError("");
    }
  }, [company]);

  useEffect(() => {
    if (!company?.company_id || pendingLogoFile) return;

    let isMounted = true;

    const loadSignedLogo = async () => {
      try {
        const signedUrl = await fetchCompanyLogoUrl(company.company_id);
        if (isMounted) {
          setLogoPreviewUrl(signedUrl || String(logoUrl || "").trim());
          setLogoLoadFailed(false);
        }
      } catch {
        if (isMounted) {
          setLogoPreviewUrl(String(logoUrl || "").trim());
        }
      }
    };

    loadSignedLogo();
    return () => {
      isMounted = false;
    };
  }, [company?.company_id, logoUrl, pendingLogoFile]);

  useEffect(() => {
    apiRequest(COMPANY_TYPES_API)
      .then((res) => res.json())
      .then(setCompanyTypes)
      .catch(console.error);
  }, []);

  const loadCompanyPeople = useCallback(async () => {
    if (!company?.company_id) return;

    setPeopleLoading(true);
    try {
      const res = await apiRequest(COMPANY_PEOPLE_API);
      const allLinks = await res.json();

      const linksForCompany = allLinks
        .filter((cp) => getCompanyIdFromCompanyPerson(cp) === Number(company.company_id))
        .map((cp) => {
          const person = getPersonFromCompanyPerson(cp);
          return {
            company_person_id: getCompanyPersonId(cp),
            person_id: getPersonIdFromCompanyPerson(cp),
            first_name: person?.first_name || "",
            last_name: person?.last_name || "",
            email: person?.email || "",
            phone: person?.phone || "",
            person_type_description: getPersonTypeDescription(person),
          };
        });

      setCompanyPeople(linksForCompany);
    } catch (err) {
      console.error("Load company people failed", err);
      setCompanyPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }, [company?.company_id]);

  useEffect(() => {
    loadCompanyPeople();
  }, [loadCompanyPeople]);

  const linkedPersonIds = companyPeople.map((cp) => cp.person_id);
  const selectedCompanyTypeDescription =
    companyTypes.find((ct) => Number(ct.company_type_id) === Number(companyTypeId))?.description ||
    company?.company_type?.description ||
    "—";

  const handleRemovePerson = async (companyPersonId) => {
    if (!companyPersonId) return;

    setRemovingLinkId(companyPersonId);
    try {
      await apiRequest(`${COMPANY_PEOPLE_API}${companyPersonId}/`, {
        method: "DELETE",
      });

      setCompanyPeople((prev) =>
        prev.filter((cp) => cp.company_person_id !== companyPersonId)
      );
    } catch (err) {
      console.error("Remove person from company failed", err);
    } finally {
      setRemovingLinkId(null);
    }
  };

  const openLogoModal = () => {
    setDraftLogoFile(null);
    setDraftLogoPreviewUrl("");
    setLogoModalError("");
    setShowLogoModal(true);
  };

  const closeLogoModal = () => {
    setShowLogoModal(false);
    setDraftLogoFile(null);
    setDraftLogoPreviewUrl("");
    setLogoModalError("");
  };

  const handleSaveLogoFromModal = () => {
    if (draftLogoFile) {
      setPendingLogoFile(draftLogoFile);
      setLogoPreviewUrl(draftLogoPreviewUrl || logoPreviewUrl);
      setLogoLoadFailed(false);
      closeLogoModal();
      return;
    }

    // No-op when no new file was selected.
    closeLogoModal();
  };

  const handleLogoFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type?.toLowerCase().startsWith("image/")) {
      setLogoModalError("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        setLogoModalError("Failed to read image file.");
        return;
      }

      setDraftLogoFile(file);
      setDraftLogoPreviewUrl(result);
      setLogoModalError("");
    };
    reader.onerror = () => {
      setLogoModalError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async () => {
    if (!company?.company_id) return;

    setSaving(true);
    setSaveError("");
    try {
      let finalLogoUrl = String(logoUrl || "").trim();

      if (pendingLogoFile) {
        const uploadTarget = await requestCompanyLogoUpload({
          fileName: pendingLogoFile.name,
          contentType: pendingLogoFile.type || "application/octet-stream",
          companyId: Number(company.company_id),
        });

        await uploadFileToPresignedUrl({
          uploadUrl: uploadTarget.upload_url,
          file: pendingLogoFile,
          contentType: pendingLogoFile.type || "application/octet-stream",
        });

        finalLogoUrl = await fetchCompanyLogoUrl(company.company_id);
      }

      const payload = {
        company_name: companyName,
        contact_name: contactName,
        contact_email: contactEmail,
        company_type_id: companyTypeId ? Number(companyTypeId) : null,
        is_active: isActive,
      };

      if (isCorporateAdmin) {
        payload.api_test_mode = apiTestMode;
        payload.api_test_email = String(apiTestEmail || "").trim() || null;
      }

      if (pendingLogoFile) {
        payload.logo_url = finalLogoUrl || null;
      }

      let response = await apiRequest(`${API_URL}${company.company_id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status === 405) {
        response = await apiRequest(`${API_URL}${company.company_id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          `Update failed with status ${response.status}`
        );
        throw new Error(message);
      }

      const updatedCompany = await response.json();
      setLogoUrl(finalLogoUrl);
      setPendingLogoFile(null);

      try {
        const signedUrl = await fetchCompanyLogoUrl(updatedCompany.company_id);
        setLogoPreviewUrl(signedUrl || finalLogoUrl);
      } catch {
        setLogoPreviewUrl(finalLogoUrl);
      }

      if (onUpdated) {
        onUpdated(updatedCompany);
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Update company failed", err);
      setSaveError(err?.message || "Failed to save company.");
    } finally {
      setSaving(false);
    }
  };

  const formatApiDebugCellValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const sortedApiDebugRows = useMemo(() => {
    return [...apiDebugRows].sort((a, b) => {
      let valA;
      let valB;

      if (apiDebugSortField === "status") {
        valA = a?.is_successful ? 1 : 0;
        valB = b?.is_successful ? 1 : 0;
      } else {
        valA = new Date(a?.timestamp || 0).getTime();
        valB = new Date(b?.timestamp || 0).getTime();
      }

      if (valA < valB) return apiDebugSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return apiDebugSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [apiDebugRows, apiDebugSortField, apiDebugSortDirection]);

  const toggleApiDebugSort = (field) => {
    if (apiDebugSortField === field) {
      setApiDebugSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setApiDebugSortField(field);
    setApiDebugSortDirection(field === "timestamp" ? "desc" : "asc");
  };

  const getApiDebugSortLabel = (field, label) => {
    if (apiDebugSortField !== field) return label;
    return `${label} ${apiDebugSortDirection === "asc" ? "▲" : "▼"}`;
  };

  const loadApiDebugRows = useCallback(async ({ openModal = false } = {}) => {
    if (!company?.company_id) return;

    if (openModal) {
      setShowApiDebugModal(true);
      setSelectedApiDebugRow(null);
    }

    setApiDebugLoading(true);
    setApiDebugError("");

    try {
      const response = await apiRequest(`${API_DEBUG_API}?company_id=${company.company_id}`);
      if (!response.ok) {
        throw new Error(`API debug request failed with status ${response.status}`);
      }

      const payload = await response.json();
      setApiDebugRows(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load API debug rows", error);
      setApiDebugRows([]);
      setApiDebugError(error?.message || "Failed to load API debug data.");
    } finally {
      setApiDebugLoading(false);
    }
  }, [company?.company_id]);

  if (!company) return null;

  const handleOpenApiDebugModal = () => {
    loadApiDebugRows({ openModal: true });
  };

  const handleRefreshApiDebugRows = () => {
    loadApiDebugRows();
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern company-form-modal">
        <div className="modal-header">
          <h3>{isEdit ? "EDIT COMPANY" : "COMPANY DETAILS"}</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="company-profile-layout">
          <div className="company-profile-left">
            <div className="company-profile-identity-card">
              <div className="company-profile-logo-wrap">
                {logoPreviewUrl && !logoLoadFailed ? (
                  <img
                    src={logoPreviewUrl}
                    alt={`${companyName || "Company"} logo`}
                    className="company-profile-logo-image"
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  <div className="company-profile-avatar">
                    {(companyName?.[0] ?? "C").toUpperCase()}
                  </div>
                )}

                {isEdit && (
                  <button
                    type="button"
                    className="company-logo-edit-button"
                    aria-label="Edit company logo"
                    onClick={openLogoModal}
                  >
                    <FaEdit />
                  </button>
                )}
              </div>
              <div className="company-profile-name">
                {companyName || "Company"}
              </div>
            </div>

            <div className="company-profile-fields-card">
              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Company Name</span>
                <div className="company-profile-field-value">
                  {isEdit ? (
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  ) : (
                    companyName || "—"
                  )}
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Company Type</span>
                <div className="company-profile-field-value">
                  {isEdit ? (
                    <select value={companyTypeId} onChange={(e) => setCompanyTypeId(e.target.value)}>
                      <option value="">Select type</option>
                      {companyTypes.map((ct) => (
                        <option key={ct.company_type_id} value={ct.company_type_id}>
                          {ct.description}
                        </option>
                      ))}
                    </select>
                  ) : (
                    selectedCompanyTypeDescription
                  )}
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Contact Name</span>
                <div className="company-profile-field-value">
                  {isEdit ? (
                    <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                  ) : (
                    contactName || "—"
                  )}
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Contact Email</span>
                <div className="company-profile-field-value">
                  {isEdit ? (
                    <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                  ) : (
                    contactEmail || "—"
                  )}
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Status</span>
                <div className="company-profile-field-value">
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
                    <span className={`status-pill ${company.is_active ? "active" : "inactive"}`}>
                      {company.is_active ? "Active" : "Inactive"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="company-data-card">
              <div className="company-data-card-header">People</div>
              <div className="company-data-card-body">
                {peopleLoading ? (
                  <div className="people-empty">Loading people...</div>
                ) : companyPeople.length === 0 ? (
                  <div className="people-empty">No people associated with this company.</div>
                ) : (
                  <div className="people-list">
                    {companyPeople.map((cp) => (
                      <div className="people-row" key={`${cp.person_id}-${cp.company_person_id ?? "temp"}`}>
                        <div>
                          <div className="people-name">{getPersonDisplayName(cp)}</div>
                          <div className="people-type">{cp.person_type_description}</div>
                        </div>
                        {isEdit && (
                          <button
                            type="button"
                            className="icon-remove"
                            title="Remove person"
                            disabled={removingLinkId === cp.company_person_id || !cp.company_person_id}
                            onClick={() => handleRemovePerson(cp.company_person_id)}
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
                    className="company-add-btn"
                    type="button"
                    onClick={() => setShowPersonModal(true)}
                  >
                    + Add Person
                  </button>
                )}
              </div>
            </div>

            {isCorporateAdmin && (
              <div className="company-data-card">
                <div className="company-data-card-header">Integrations</div>
                <div className="company-data-card-body">
                  <div className="integration-field-row">
                    <span className="integration-field-label">API Test Mode</span>
                    <div className="integration-field-value">
                      {isEdit ? (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={apiTestMode}
                            onChange={(e) => setApiTestMode(e.target.checked)}
                          />
                          <span>{apiTestMode ? "Enabled" : "Disabled"}</span>
                        </label>
                      ) : (
                        <span className={`status-pill ${apiTestMode ? "active" : "inactive"}`}>
                          {apiTestMode ? "Enabled" : "Disabled"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="integration-field-row">
                    <span className="integration-field-label">API Test Email</span>
                    <div className="integration-field-value">
                      {isEdit ? (
                        <input
                          type="email"
                          value={apiTestEmail}
                          onChange={(e) => setApiTestEmail(e.target.value)}
                          placeholder="name@example.com"
                        />
                      ) : (
                        apiTestEmail || "—"
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="integration-link-btn"
                    onClick={handleOpenApiDebugModal}
                  >
                    Show API Debug Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          {saveError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{saveError}</p>}
          <button onClick={onClose}>Close</button>
          {isEdit && (
            <button className="primary" onClick={handleSaveCompany} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {showPersonModal && (
          <PersonModal
            companyId={company.company_id}
            linkedPersonIds={linkedPersonIds}
            onClose={() => setShowPersonModal(false)}
            onPersonAdded={() => {
              setShowPersonModal(false);
              loadCompanyPeople();
            }}
          />
        )}

        {showLogoModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "560px" }}>
              <div className="modal-header">
                <h3>Edit Logo</h3>
                <button className="icon-close" onClick={closeLogoModal}>✕</button>
              </div>

              <div className="company-logo-modal-layout">
                <div className="company-logo-modal-preview-pane">
                  {(() => {
                    const previewSrc = draftLogoPreviewUrl || logoPreviewUrl;
                    if (previewSrc && !logoLoadFailed) {
                      return (
                        <img
                          src={previewSrc}
                          alt={`${companyName || "Company"} logo preview`}
                          className="company-logo-modal-preview-image"
                          onError={() => setLogoLoadFailed(true)}
                        />
                      );
                    }

                    return (
                      <div className="company-logo-modal-preview-fallback">
                        {(companyName?.[0] ?? "C").toUpperCase()}
                      </div>
                    );
                  })()}
                </div>

                <div className="company-logo-modal-upload-pane">
                  <Detail label="Uploaded Logo File">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelected}
                    />
                  </Detail>
                </div>
              </div>

              <div className="modal-actions">
                {logoModalError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{logoModalError}</p>}
                <button onClick={closeLogoModal}>Cancel</button>
                <button className="primary" onClick={handleSaveLogoFromModal}>Use this Logo</button>
              </div>
            </div>
          </div>
        )}

        {showApiDebugModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern api-debug-modal">
              <div className="modal-header">
                <div className="api-debug-modal-title-row">
                  <h3>API DEBUG DATA</h3>
                  <button
                    className="api-debug-refresh-btn"
                    onClick={handleRefreshApiDebugRows}
                    disabled={apiDebugLoading}
                    title={apiDebugLoading ? "Refreshing..." : "Refresh"}
                    aria-label={apiDebugLoading ? "Refreshing..." : "Refresh"}
                  >
                    {apiDebugLoading ? "⟳" : "↻"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button className="icon-close" onClick={() => setShowApiDebugModal(false)}>✕</button>
                </div>
              </div>

              {apiDebugLoading ? (
                <div className="people-empty">Loading debug data...</div>
              ) : apiDebugError ? (
                <div className="api-debug-error">{apiDebugError}</div>
              ) : apiDebugRows.length === 0 ? (
                <div className="people-empty">No debug rows found for this company.</div>
              ) : (
                <div className="api-debug-table-wrap">
                  <table className="api-debug-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th onClick={() => toggleApiDebugSort("timestamp")}>
                          {getApiDebugSortLabel("timestamp", "Timestamp")}
                        </th>
                        <th>Source IP</th>
                        <th onClick={() => toggleApiDebugSort("status")}>
                          {getApiDebugSortLabel("status", "Status")}
                        </th>
                        <th>API Key</th>
                        <th>Headers</th>
                        <th>Body</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedApiDebugRows.map((row) => (
                        <tr
                          key={row.api_debug_id}
                          className="api-debug-row"
                          onClick={() => setSelectedApiDebugRow(row)}
                        >
                          <td>{row.api_debug_id}</td>
                          <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}</td>
                          <td className="api-debug-truncate">{formatApiDebugCellValue(row.source_ip)}</td>
                          <td>
                            <span className={`status-pill ${row.is_successful ? "active" : "inactive"}`}>
                              {row.is_successful ? "Successful" : "Failed"}
                            </span>
                          </td>
                          <td className="api-debug-truncate">{formatApiDebugCellValue(row.api_key)}</td>
                          <td className="api-debug-truncate">{formatApiDebugCellValue(row.headers)}</td>
                          <td className="api-debug-truncate">{formatApiDebugCellValue(row.body)}</td>
                          <td className="api-debug-truncate">{formatApiDebugCellValue(row.error_text)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="modal-actions">
                <button onClick={() => setShowApiDebugModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {selectedApiDebugRow && (
          <div className="modal-overlay" style={{ zIndex: 1400 }}>
            <div className="modal modern api-debug-details-modal">
              <div className="modal-header">
                <h3>API DEBUG DETAILS</h3>
                <button className="icon-close" onClick={() => setSelectedApiDebugRow(null)}>✕</button>
              </div>

              <div className="api-debug-details-grid">
                <Detail label="Debug ID">{formatApiDebugCellValue(selectedApiDebugRow.api_debug_id)}</Detail>
                <Detail label="Timestamp">{formatApiDebugCellValue(selectedApiDebugRow.timestamp)}</Detail>
                <Detail label="Company ID">{formatApiDebugCellValue(selectedApiDebugRow.company_id)}</Detail>
                <Detail label="Source IP">{formatApiDebugCellValue(selectedApiDebugRow.source_ip)}</Detail>
                <Detail label="Status">
                  <span className={`status-pill ${selectedApiDebugRow.is_successful ? "active" : "inactive"}`}>
                    {selectedApiDebugRow.is_successful ? "Successful" : "Failed"}
                  </span>
                </Detail>
                <Detail label="API Key">{formatApiDebugCellValue(selectedApiDebugRow.api_key)}</Detail>
              </div>

              <div className="api-debug-json-block">
                <div className="api-debug-json-label">Headers</div>
                <pre>{JSON.stringify(selectedApiDebugRow.headers ?? {}, null, 2)}</pre>
              </div>

              <div className="api-debug-json-block">
                <div className="api-debug-json-label">Body</div>
                <pre>{JSON.stringify(selectedApiDebugRow.body ?? {}, null, 2)}</pre>
              </div>

              <div className="api-debug-json-block">
                <div className="api-debug-json-label">Error Text</div>
                <pre className="api-debug-error-text-pre">{formatApiDebugCellValue(selectedApiDebugRow.error_text)}</pre>
              </div>

              <div className="modal-actions">
                <button onClick={() => setSelectedApiDebugRow(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AddCompanyModal = ({ onClose, onCreated }) => {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [companyTypeId, setCompanyTypeId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [draftLogoFile, setDraftLogoFile] = useState(null);
  const [draftLogoPreviewUrl, setDraftLogoPreviewUrl] = useState("");
  const [logoModalError, setLogoModalError] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [companyTypes, setCompanyTypes] = useState([]);
  const [stagedPeople, setStagedPeople] = useState([]);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    apiRequest(COMPANY_TYPES_API)
      .then((r) => r.json())
      .then(setCompanyTypes)
      .catch(console.error);
  }, []);

  const handleRemoveStagedPerson = (personId) => {
    setStagedPeople((prev) => prev.filter((p) => p.person_id !== personId));
  };

  const openLogoModal = () => {
    setDraftLogoFile(null);
    setDraftLogoPreviewUrl("");
    setLogoModalError("");
    setShowLogoModal(true);
  };

  const closeLogoModal = () => {
    setShowLogoModal(false);
    setDraftLogoFile(null);
    setDraftLogoPreviewUrl("");
    setLogoModalError("");
  };

  const handleSaveLogoFromModal = () => {
    if (draftLogoFile) {
      setPendingLogoFile(draftLogoFile);
      setLogoPreviewUrl(draftLogoPreviewUrl || logoPreviewUrl);
      setLogoLoadFailed(false);
      closeLogoModal();
      return;
    }

    // No-op when no new file was selected.
    closeLogoModal();
  };

  const handleLogoFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type?.toLowerCase().startsWith("image/")) {
      setLogoModalError("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        setLogoModalError("Failed to read image file.");
        return;
      }

      setDraftLogoFile(file);
      setDraftLogoPreviewUrl(result);
      setLogoModalError("");
    };
    reader.onerror = () => {
      setLogoModalError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");

    try {
      // 1️⃣ Create company
      const companyRes = await apiRequest(
        API_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: companyName,
            contact_name: contactName,
            contact_email: contactEmail,
            company_type_id: companyTypeId ? Number(companyTypeId) : null,
            is_active: isActive,
            logo_url:
              pendingLogoFile
                ? null
                : (logoUrl ? String(logoUrl).trim() : null),
          }),
        }
      );

      if (!companyRes.ok) {
        const message = await readErrorMessage(
          companyRes,
          `Create failed with status ${companyRes.status}`
        );
        throw new Error(message);
      }

      let company = await companyRes.json();
      const createdCompanyId = Number(company?.company_id || 0);

      if (!createdCompanyId) {
        throw new Error("Company create succeeded but no company_id was returned.");
      }

      if (pendingLogoFile) {
        const uploadTarget = await requestCompanyLogoUpload({
          fileName: pendingLogoFile.name,
          contentType: pendingLogoFile.type || "application/octet-stream",
          companyId: createdCompanyId,
        });

        await uploadFileToPresignedUrl({
          uploadUrl: uploadTarget.upload_url,
          file: pendingLogoFile,
          contentType: pendingLogoFile.type || "application/octet-stream",
        });

        const resolvedLogoUrl = await fetchCompanyLogoUrl(createdCompanyId);

        const logoPatchRes = await apiRequest(`${API_URL}${createdCompanyId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo_url: String(resolvedLogoUrl || "").trim() || null,
          }),
        });

        if (!logoPatchRes.ok) {
          const logoPatchMessage = await readErrorMessage(
            logoPatchRes,
            `Logo update failed with status ${logoPatchRes.status}`
          );
          throw new Error(logoPatchMessage);
        }

        company = await logoPatchRes.json();
        setLogoUrl(String(resolvedLogoUrl || "").trim());
        setPendingLogoFile(null);
      }

      for (const person of stagedPeople) {
        try {
          await apiRequest(COMPANY_PEOPLE_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_id: createdCompanyId,
              person_id: person.person_id,
            }),
          });
        } catch (linkErr) {
          console.error("Link person to company failed", linkErr);
        }
      }

      if (onCreated) {
        onCreated(company);
      } else {
        onClose();
      }

    } catch (err) {
      console.error("Create company failed", err);
      setSaveError(err?.message || "Failed to create company.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modern company-form-modal">
        <div className="modal-header">
          <h3>ADD NEW COMPANY</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="company-profile-layout">
          <div className="company-profile-left">
            <div className="company-profile-identity-card">
              <div className="company-profile-logo-wrap">
                {logoPreviewUrl && !logoLoadFailed ? (
                  <img
                    src={logoPreviewUrl}
                    alt={`${companyName || "Company"} logo`}
                    className="company-profile-logo-image"
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : (
                  <div className="company-profile-avatar">
                    {(companyName?.[0] ?? "C").toUpperCase()}
                  </div>
                )}

                <button
                  type="button"
                  className="company-logo-edit-button"
                  aria-label="Edit company logo"
                  onClick={openLogoModal}
                >
                  <FaEdit />
                </button>
              </div>
              <div className="company-profile-name">
                {companyName || "New Company"}
              </div>
            </div>

            <div className="company-profile-fields-card">
              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Company Name</span>
                <div className="company-profile-field-value">
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Company Type</span>
                <div className="company-profile-field-value">
                  <select value={companyTypeId} onChange={(e) => setCompanyTypeId(e.target.value)}>
                    <option value="">Select type</option>
                    {companyTypes.map((ct) => (
                      <option key={ct.company_type_id} value={ct.company_type_id}>
                        {ct.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Contact Name</span>
                <div className="company-profile-field-value">
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Contact Email</span>
                <div className="company-profile-field-value">
                  <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>

              <div className="company-profile-field-row">
                <span className="company-profile-field-label">Status</span>
                <div className="company-profile-field-value">
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

            <div className="company-data-card">
              <div className="company-data-card-header">People</div>
              <div className="company-data-card-body">
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
                          onClick={() => handleRemoveStagedPerson(person.person_id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="company-add-btn"
                  type="button"
                  onClick={() => setShowPersonModal(true)}
                >
                  + Add Person
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {saveError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{saveError}</p>}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Create Company"}
          </button>
        </div>

        {showPersonModal && (
          <PersonModal
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

        {showLogoModal && (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal modern" style={{ width: "560px" }}>
              <div className="modal-header">
                <h3>Edit Logo</h3>
                <button className="icon-close" onClick={closeLogoModal}>✕</button>
              </div>

              <div className="company-logo-modal-layout">
                <div className="company-logo-modal-preview-pane">
                  {(() => {
                    const previewSrc = draftLogoPreviewUrl || logoPreviewUrl;
                    if (previewSrc && !logoLoadFailed) {
                      return (
                        <img
                          src={previewSrc}
                          alt={`${companyName || "Company"} logo preview`}
                          className="company-logo-modal-preview-image"
                          onError={() => setLogoLoadFailed(true)}
                        />
                      );
                    }

                    return (
                      <div className="company-logo-modal-preview-fallback">
                        {(companyName?.[0] ?? "C").toUpperCase()}
                      </div>
                    );
                  })()}
                </div>

                <div className="company-logo-modal-upload-pane">
                  <Detail label="Uploaded Logo File">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelected}
                    />
                  </Detail>
                </div>
              </div>

              <div className="modal-actions">
                {logoModalError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{logoModalError}</p>}
                <button onClick={closeLogoModal}>Cancel</button>
                <button className="primary" onClick={handleSaveLogoFromModal}>Use this Logo</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PersonModal = ({ companyId, linkedPersonIds, onClose, onPersonAdded }) => {
  const [people, setPeople] = useState([]);
  const [personTypes, setPersonTypes] = useState([]);
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
    ])
      .then(([peopleData, personTypeData]) => {
        setPeople(peopleData);
        setPersonTypes(personTypeData);
      })
      .catch(console.error);
  }, []);

  const availablePeople = people.filter(
    (person) => !linkedPersonIds.includes(Number(person.person_id))
  );

  const linkPersonToCompany = async (personId) => {
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
      let personIdToLink = selectedPersonId ? Number(selectedPersonId) : null;

      if (!personIdToLink) {
        const createPersonRes = await apiRequest(PEOPLE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            phone: normalizePhoneForStorage(phone),
            person_type_id: personTypeId ? Number(personTypeId) : null,
          }),
        });

        personToAdd = await createPersonRes.json();
        personIdToLink = Number(personToAdd.person_id);
      } else {
        personToAdd = people.find((p) => Number(p.person_id) === personIdToLink) || null;
      }

      if (companyId && personIdToLink) {
        await linkPersonToCompany(personIdToLink);
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

      onPersonAdded({ person: personToAdd, personId: personIdToLink });
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
          <h3>Person</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="details-grid">
          <Detail label="Existing Person">
            <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)}>
              <option value="">Select person</option>
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
              value={formatPhoneForDisplay(phone)}
              onChange={(e) => setPhone(normalizePhoneForStorage(e.target.value))}
              disabled={!!selectedPersonId}
            />
          </Detail>

          <Detail label="Person Type">
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
          <button className="primary" disabled={saving} onClick={handleAddPerson}>
            {saving ? "Saving..." : "Add Person"}
          </button>
        </div>
      </div>
    </div>
  );
};



/* ----------------------------------
   Reusable Detail Row
---------------------------------- */

const Detail = ({ label, children }) => (
  <div className="detail-row">
    <div className="detail-label">{label}</div>
    <div className="detail-value">{children}</div>
  </div>
);

