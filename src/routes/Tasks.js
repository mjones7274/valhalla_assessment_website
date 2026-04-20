// src/routes/Tasks.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [checkedTaskIds, setCheckedTaskIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);

      const userType = sessionStorage.getItem("user_type");
      const familyId = sessionStorage.getItem("family_id");

      // If not logged in, redirect to Home
      // if (!userType) {
      //   navigate("/");
      //   return;
      // }

      let url = process.env.REACT_APP_API_URL_BASE + "/tasks/";
      if (userType === "customer" && familyId) {
        url = `${url}family/${familyId}/`;
      }

      try {
        const res = await apiRequest(url);
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [navigate]);

  const toggleExpand = (taskId) => {
    setExpandedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleCheck = (taskId) => {
    setCheckedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <span>Loading tasks...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: "700px", width: "100%" }}>
        <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "24px" }}>
          Tasks
        </h1>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {tasks.map((task) => {
            const isExpanded = expandedTaskIds.includes(task.task_id);
            const isChecked = checkedTaskIds.includes(task.task_id);

            const assignedTo = task.assigned_to
              ? `${task.assigned_to.first_name}`
              : "N/A";

            return (
              <li
                key={task.task_id}
                style={{
                  padding: "12px 16px",
                  marginBottom: "12px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  borderLeft: task.is_completed ? "4px solid #28a745" : "4px solid #007bff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Top row: checkbox + title + assigned to */}
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  onClick={() => toggleExpand(task.task_id)}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCheck(task.task_id);
                      }}
                      style={{ marginRight: "12px" }}
                    />
                    <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                      {task.task_description}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    Assigned To:{" "}
                    {assignedTo === sessionStorage.getItem("first_name") ? (
                      <span style={{ fontWeight: "bold", fontSize: "0.99rem" }}>
                        {assignedTo}
                      </span>
                    ) : (
                      assignedTo
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "#555" }}>
                    <div>Family: {task.family.family_name}</div>
                    <div>Created By: {task.created_by.first_name} {task.created_by.last_name}</div>
                    <div>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                    <div>Status: {task.is_completed ? "Completed ✅" : task.is_active ? "Active" : "Inactive"}</div>
                    {task.completion_date && (
                      <div>Completed On: {new Date(task.completion_date).toLocaleDateString()}</div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default Tasks;
