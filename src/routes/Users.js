import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Users.css"; // you can reuse Patients.css with tweaks
import UserModal from "./UserModal";
import { apiRequest } from "../api";


const USERS_VIEW_URL = `${process.env.REACT_APP_API_URL_BASE}/api/users-view/`;


const Users = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("user_id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState(null); // "view" | "edit" | "add"

  const loadUsers = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  const sortedUsers = useMemo(() => {
    return [...users]
      .filter(matchesSearch)
      .sort((a, b) => {
        let valA, valB;
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
  }, [users, sortField, sortDirection, matchesSearch, getCompanyNames]);

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
      <h2>Users</h2>

      <div className="users-toolbar">
        <input
          className="search-bar"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="users-actions">
        <button
          className="primary"
          onClick={() => {
            setSelectedUser(null);
            setModalMode("add");
          }}
        >
          + Add New User
        </button>
      </div>

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
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {sortedUsers.map((u) => (
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
              <td className="actions">
                <button
                  title="View Details"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedUser(u);
                    setModalMode("view");
                  }}
                >
                  👁
                </button>
                <button
                  title="Edit User"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedUser(u);
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
