// src/routes/Priorities.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

function Priorities() {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPriorities = async () => {
      setLoading(true);

      const userType = sessionStorage.getItem("user_type");
      const familyId = sessionStorage.getItem("family_id");

      // If not logged in, redirect to Home
      // if (!userType) {
      //   navigate("/");
      //   return;
      // }

      let url = process.env.REACT_APP_API_URL_BASE + "/priorities/";
      if (userType === "customer" && familyId) {
        url = `${url}family/${familyId}/`;
      }

      try {
        const res = await apiRequest(url);
        const data = await res.json();
        setPriorities(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching priorities:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPriorities();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <span>Loading priorities...</span>
      </div>
    );
  }

  // Group by family
  const grouped = priorities.reduce((acc, priority) => {
    const familyName = priority.family.family_name;
    if (!acc[familyName]) acc[familyName] = [];
    acc[familyName].push(priority);
    return acc;
  }, {});

  // Sort each family's priorities by weight
  Object.keys(grouped).forEach((family) => {
    grouped[family].sort((a, b) => a.weight - b.weight);
  });

  return (
    <div
      style={{
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: "800px", width: "100%" }}>
        <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "24px" }}>
          Priorities
        </h1>

        {Object.entries(grouped).map(([familyName, prioritiesList]) => (
          <div key={familyName} style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "12px" }}>{familyName}</h2>

            <ul style={{ listStyle: "none", padding: 0 }}>
              {prioritiesList.map((priority) => (
                <li
                  key={priority.priority_id}
                  style={{
                    padding: "12px 16px",
                    marginBottom: "10px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    borderLeft: priority.is_active ? "4px solid #007bff" : "4px solid #ccc",
                  }}
                >
                  <strong>{priority.weight}. {priority.priority_description}</strong> &nbsp;
                  <span style={{ fontSize: "0.85rem", color: "#555" }}>
                    Created By: {priority.created_by.first_name} {priority.created_by.last_name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Priorities;
