// src/routes/Families.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

function Families() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFamilies = async () => {
      setLoading(true);

      const userType = sessionStorage.getItem("user_type");
      const familyId = sessionStorage.getItem("family_id");

      // If not logged in, redirect to Home
      // if (!userType) {
      //   navigate("/");
      //   return;
      // }

      let url = process.env.REACT_APP_API_URL_BASE + "/families/";
      if (userType === "customer" && familyId) {
        url = `${url}family/${familyId}/`;
      }

      try {
        const res = await apiRequest(url);
        const data = await res.json();

        // Ensure data is always an array
        setFamilies(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching families:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilies();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <span>Loading families...</span>
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
      <div
        style={{
          maxWidth: "600px",
          width: "100%",
        }}
      >
        <h1 style={{ textAlign: "center", fontSize: "2rem", marginBottom: "24px" }}>
          Families
        </h1>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {families.map((family) => (
            <li
              key={family.family_id}
              style={{
                padding: "12px 16px",
                marginBottom: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              {family.family_name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Families;
