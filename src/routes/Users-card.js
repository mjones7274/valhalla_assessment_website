import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";
import "./Users.css";

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // const userType = sessionStorage.getItem("user_type");

    // Redirect to Home if not logged in
    // if (!userType) {
    //   navigate("/");
    //   return;
    // }

    const url = process.env.REACT_APP_API_URL_BASE + "/api/users/";

    apiRequest(url)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching users:", err);
        setLoading(false);
      });
  }, [navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="users-page">
      <div className="users-wrapper">
        <h2 className="users-title">Users</h2>

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="users-grid">
            {users.map((user) => (
              <div key={user.customer_id} className="user-card">
                <h3>
                  {user.first_name} {user.last_name}
                </h3>
                <p>
                  <strong>Username:</strong> {user.username}
                </p>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Created On:</strong> {formatDate(user.created_on)}
                </p>
                <p>
                  <strong>Last Login:</strong> {formatDate(user.last_login)}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={user.is_active ? "active" : "inactive"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </p>

                {/* Reset Password Button (UI only) */}
                <button className="reset-btn">Reset Password</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Users;
