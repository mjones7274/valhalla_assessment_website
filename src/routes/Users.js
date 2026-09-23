import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import "./Users.css"; // you can reuse Patients.css with tweaks
import UserModal from "./UserModal";
import { apiRequest } from "../api";


const USERS_VIEW_URL = `${process.env.REACT_APP_API_URL_BASE}/api/users-view/`;
const COMPANIES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/companies/`;

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

const getUserId = (user) =>
  Number(user?.user_id ?? user?.id ?? user?.customer_id ?? 0);

const USER_TYPE_PILLS = {
  company: { label: "User", className: "user" },
  company_admin: { label: "Admin", className: "admin" },
  corporate_admin: { label: "Corporate Admin", className: "corporate-admin" },
};

const getUserTypeDescription = (user) =>
  String(user?.user_type?.description ?? "").trim().toLowerCase();

const UserTypePill = ({ description }) => {
  const normalizedDescription = String(description ?? "").trim().toLowerCase();
  const pill = USER_TYPE_PILLS[normalizedDescription];

  if (!pill) return normalizedDescription || "—";

  return (
    <span className={`users-type-pill ${pill.className}`}>
      {pill.label}
    </span>
  );
};

const getUserCompanyIds = (user) => {
  const candidateSources = [
    user?.companies,
    user?.user_companies,
    user?.associated_companies,
  ];

  if (user?.company) {
    candidateSources.push([user.company]);
  }

  return Array.from(
    new Set(
      candidateSources
        .flatMap((source) => (Array.isArray(source) ? source : []))
        .map((entry) => Number(entry?.company?.company_id ?? entry?.company_id ?? entry?.company?.id ?? entry?.id ?? 0))
        .filter((companyId) => Number.isFinite(companyId) && companyId > 0)
    )
  );
};


const Users = () => {
  const { user } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilterOptions, setCompanyFilterOptions] = useState([]);
  const [companyFilterId, setCompanyFilterId] = useState("");
  const [sortField, setSortField] = useState("user_id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState(null); // "view" | "edit" | "add"

  const userTypeId = getUserTypeId(user);
  const isCorporateAdmin = userTypeId === 3;
  const currentUserId = getUserId(user);
  const currentUserCompanyIds = useMemo(() => getUserCompanyIds(user), [user]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const withSlashRes = await apiRequest(USERS_VIEW_URL);
      if (withSlashRes.ok) {
        const data = await withSlashRes.json();
        setUsers(Array.isArray(data) ? data : []);
        return;
      }

      const noSlashRes = await apiRequest(USERS_VIEW_URL.replace(/\/$/, ""));
      if (!noSlashRes.ok) {
        throw new Error(`Users view request failed (${noSlashRes.status})`);
      }

      const fallbackData = await noSlashRes.json();
      setUsers(Array.isArray(fallbackData) ? fallbackData : []);
    } catch (error) {
      console.error("Failed to load users view", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!isCorporateAdmin) {
      setCompanyFilterOptions([]);
      setCompanyFilterId("");
      return;
    }

    const loadCompanyFilterOptions = async () => {
      try {
        const response = await apiRequest(COMPANIES_URL);
        if (!response.ok) {
          throw new Error(`Companies request failed (${response.status})`);
        }

        const companyRows = await response.json();
        setCompanyFilterOptions(
          (Array.isArray(companyRows) ? companyRows : [])
            .filter((company) => Number(company?.company_id ?? company?.id ?? 0) > 0)
            .sort((left, right) =>
              String(left?.company_name ?? left?.name ?? "").localeCompare(
                String(right?.company_name ?? right?.name ?? ""),
                undefined,
                { sensitivity: "base" }
              )
            )
        );
      } catch (error) {
        console.error("Failed to load company filter options", error);
        setCompanyFilterOptions([]);
      }
    };

    loadCompanyFilterOptions();
  }, [isCorporateAdmin]);

  const getCompanyNames = useCallback(
    (u) => u.companies?.map((c) => c.company_name).join(", ") || "",
    []
  );

  const getCompanyList = useCallback(
    (u) => u.companies?.map((c) => c.company_name).filter(Boolean) || [],
    []
  );

  const matchesSearch = useCallback((u) => {
    const searchText = search.toLowerCase();
    return (
      u.user_id.toString().includes(searchText) ||
      u.first_name.toLowerCase().includes(searchText) ||
      u.last_name.toLowerCase().includes(searchText) ||
      u.username.toLowerCase().includes(searchText) ||
      u.email.toLowerCase().includes(searchText) ||
      getUserTypeDescription(u).includes(searchText) ||
      getCompanyNames(u).toLowerCase().includes(searchText) ||
      (u.last_login && u.last_login.toLowerCase().includes(searchText))
    );
  }, [search, getCompanyNames]);

  const updateUserInState = useCallback((updatedUser) => {
    if (!updatedUser?.user_id) return;

    setUsers((prev) =>
      prev.map((existingUser) =>
        existingUser.user_id === updatedUser.user_id ? updatedUser : existingUser
      )
    );

    setSelectedUser((prev) =>
      prev?.user_id === updatedUser.user_id ? updatedUser : prev
    );
  }, []);

  const visibleUsers = useMemo(() => {
    if (isCorporateAdmin) {
      const selectedCompanyId = Number(companyFilterId);
      if (selectedCompanyId > 0) {
        return users.filter((listedUser) =>
          getUserCompanyIds(listedUser).includes(selectedCompanyId)
        );
      }

      return users;
    }

    if (userTypeId === 2) {
      if (currentUserCompanyIds.length === 0) {
        return [];
      }

      return users.filter((listedUser) => {
        const listedCompanyIds = getUserCompanyIds(listedUser);
        return listedCompanyIds.some((companyId) => currentUserCompanyIds.includes(companyId));
      });
    }

    if (userTypeId === 1) {
      return users.filter((listedUser) => getUserId(listedUser) === currentUserId);
    }

    return [];
  }, [companyFilterId, currentUserCompanyIds, currentUserId, isCorporateAdmin, userTypeId, users]);

  const sortedUsers = useMemo(() => {
    return [...visibleUsers]
      .filter(matchesSearch)
      .sort((a, b) => {
        let valA, valB;
        switch (sortField) {
          case "company":
            valA = getCompanyNames(a);
            valB = getCompanyNames(b);
            break;
          case "user_type":
            valA = getUserTypeDescription(a);
            valB = getUserTypeDescription(b);
            break;
          default:
            valA = a[sortField];
            valB = b[sortField];
        }
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [visibleUsers, sortField, sortDirection, matchesSearch, getCompanyNames]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="users-page">
      <header className="portal-page-header">
        <div>
          <p className="portal-page-kicker">Access management</p>
          <h1 className="portal-page-title">
            Users
            <span className="portal-page-count">{sortedUsers.length}</span>
          </h1>
          <p className="portal-page-subtitle">Manage portal access, roles, and company assignments.</p>
        </div>
        {userTypeId !== 1 && (
          <div className="portal-page-actions">
            <button
              className="primary portal-primary-action"
              onClick={() => {
                setSelectedUser(null);
                setModalMode("add");
              }}
            >
              + Add New User
            </button>
          </div>
        )}
      </header>

      <div className="users-toolbar portal-command-bar">
        <label className="portal-search-field" htmlFor="users-search">
          <span>Search</span>
          <input
            id="users-search"
            className="search-bar portal-search-input"
            placeholder="Search users..."
            aria-label="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {isCorporateAdmin && (
          <label className="users-company-filter">
            <span>Company</span>
            <select
              value={companyFilterId}
              onChange={(event) => setCompanyFilterId(event.target.value)}
            >
              <option value="">All</option>
              {companyFilterOptions.map((company) => {
                const companyId = company?.company_id ?? company?.id;
                return (
                  <option key={companyId} value={companyId}>
                    {company?.company_name ?? company?.name ?? `Company ${companyId}`}
                  </option>
                );
              })}
            </select>
          </label>
        )}
      </div>

      <div className="portal-table-shell">
      <table className="users-table">
        <thead>
          <tr>
            <th onClick={() => toggleSort("user_id")}>ID</th>
            <th onClick={() => toggleSort("first_name")}>First Name</th>
            <th onClick={() => toggleSort("last_name")}>Last Name</th>
            <th onClick={() => toggleSort("username")}>Username</th>
            <th className="users-col-center" onClick={() => toggleSort("email")}>Email</th>
            <th className="users-col-center" onClick={() => toggleSort("last_login")}>Last Login</th>
            <th className="users-col-center" onClick={() => toggleSort("company")}>Companies</th>
            <th className="users-col-center" onClick={() => toggleSort("user_type")}>Type</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <tr key={`user-skeleton-${index}`} className="users-table-skeleton-row" aria-hidden="true">
                <td><div className="users-skeleton-line users-skeleton-id" /></td>
                <td><div className="users-skeleton-line users-skeleton-name" /></td>
                <td><div className="users-skeleton-line users-skeleton-name" /></td>
                <td><div className="users-skeleton-line users-skeleton-username" /></td>
                <td><div className="users-skeleton-line users-skeleton-email" /></td>
                <td><div className="users-skeleton-line users-skeleton-login" /></td>
                <td><div className="users-skeleton-line users-skeleton-companies" /></td>
                <td><div className="users-skeleton-line users-skeleton-type" /></td>
                <td><div className="users-skeleton-line users-skeleton-actions" /></td>
              </tr>
            ))
          ) : sortedUsers.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <div className="users-table-empty">No users found.</div>
              </td>
            </tr>
          ) : (
            sortedUsers.map((u) => (
              <tr
                key={u.user_id}
                onClick={() => {
                  setSelectedUser(u);
                  setModalMode("view");
                }}
                style={{ cursor: "pointer" }}
              >
                <td>{u.user_id}</td>
                <td>{u.first_name}</td>
                <td>{u.last_name}</td>
                <td>{u.username}</td>
                <td className="users-col-center">{u.email}</td>
                <td className="users-col-center">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                <td className="users-col-center users-companies-cell">
                  {getCompanyList(u).length > 0 ? (
                    getCompanyList(u).map((companyName, index) => (
                      <div key={`${u.user_id}-company-${index}`} className="users-company-line">
                        {companyName}
                      </div>
                    ))
                  ) : (
                    "—"
                  )}
                </td>
                <td className="users-col-center">
                  <UserTypePill description={u?.user_type?.description} />
                </td>
                <td className="actions">
                  <button
                    type="button"
                    className="user-row-icon-btn user-row-view-icon-btn"
                    title="View Details"
                    aria-label="View details"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedUser(u);
                      setModalMode("view");
                    }}
                  >
                    <Eye strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className="user-row-icon-btn user-row-edit-icon-btn"
                    title="Edit User"
                    aria-label="Edit user"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedUser(u);
                      setModalMode("edit");
                    }}
                  >
                    <Pencil strokeWidth={1.75} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

      {modalMode && (
        modalMode === "add" ? (
          <UserModal
            mode="add"
            onClose={() => setModalMode(null)}
            onSaved={(newUser) => {
              setUsers((prev) => [...prev, newUser]);
              setModalMode(null);
            }}
          />
        ) : (
          <UserModal
            mode={modalMode}
            user={selectedUser}
            onClose={() => setModalMode(null)}
            onUserUpdated={updateUserInState}
            onSaved={(updatedUser) => {
              updateUserInState(updatedUser);
              setModalMode(null);
            }}
          />
        )
      )}
    </div>
  );
};

export default Users;
