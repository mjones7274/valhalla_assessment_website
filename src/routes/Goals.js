// src/routes/Goals.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();


  useEffect(() => {
    const fetchGoals = async () => {
      setLoading(true);

      const userType = sessionStorage.getItem("user_type");
      const familyId = sessionStorage.getItem("family_id");

      // If not logged in, redirect to Home
      // if (!userType) {
      //   navigate("/");
      //   return;
      // }

      let url = process.env.REACT_APP_API_URL_BASE + "/goals/";
      if (userType === "customer" && familyId) {
        url = `${url}family/${familyId}/`;
      }

      try {
        const res = await apiRequest(url);
        const data = await res.json();
        setGoals(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching goals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <span>Loading goals...</span>
      </div>
    );
  }

  // Group goals by family and then goal type
  const grouped = goals.reduce((acc, goal) => {
    const familyName = goal.family.family_name;
    const goalType = goal.goal_type.goal_type_description;

    if (!acc[familyName]) acc[familyName] = {};
    if (!acc[familyName][goalType]) acc[familyName][goalType] = [];

    acc[familyName][goalType].push(goal);
    return acc;
  }, {});

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
          Goals
        </h1>

        {Object.entries(grouped).map(([familyName, goalTypes]) => (
          <div key={familyName} style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "12px" }}>{familyName}</h2>

            {Object.entries(goalTypes).map(([goalType, goalsList]) => (
              <div key={goalType} style={{ marginLeft: "20px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>{goalType}</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {goalsList.map((goal) => (
                    <li
                      key={goal.goal_id}
                      style={{
                        padding: "10px 14px",
                        marginBottom: "8px",
                        backgroundColor: "#f9f9f9",
                        borderRadius: "6px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        borderLeft: goal.is_active ? "4px solid #007bff" : "4px solid #ccc",
                      }}
                    >
                      <strong>{goal.goal_description}</strong> &nbsp;
                      <span style={{ fontSize: "0.85rem", color: "#555" }}>
                        Created By: {goal.created_by.first_name} {goal.created_by.last_name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Goals;
