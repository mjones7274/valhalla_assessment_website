import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";

import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { user } = useOutletContext() || {};
  const userTypeId = Number(
    user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0
  );
  const useClientTerminology = shouldUseClientTerminology(user);

  // in order to get user from a page
  // const { user, loggedIn } = useOutletContext();

  const allCards = [
    {
      title: "Assessments",
      description:
        "create and manage assessments.",
      path: "/assessments",
    },
    {
      title: "Patients",
      description:
        "Manage and track patient information, treatment plans, and progress.",
      path: "/patients",
    },
    {
      title: "Companies",
      description:
        "Create and manage companies.",
      path: "/companies",
    },
    {
      title: "Users",
      description:
        "Create and manage users.",
      path: "/users",
    },
  ];

  const cards = allCards.filter((card) => {
    if (userTypeId === 3) {
      return (
        card.path === "/assessments" ||
        card.path === "/patients" ||
        card.path === "/companies" ||
        card.path === "/users"
      );
    }

    if (userTypeId === 2) {
      return card.path === "/patients" || card.path === "/users";
    }

    if (userTypeId === 1) {
      return card.path === "/patients";
    }

    return false;
  });

  return (
    <div className="home-container">
      {/* Welcome description */}
      <section className="welcome">
        <p className="description">
          {replacePatientText(
            "Manage and track assessments, treatment plans, and progress for TBI patients.",
            useClientTerminology
          )}
        </p>
      </section>

      {/* Feature Cards */}
      <section className="features">
        {cards.map((card, index) => (
          <div
            key={index}
            className="feature-card clickable"
            onClick={() => navigate(card.path)}
          >
            <h2>{replacePatientText(card.title, useClientTerminology)}</h2>
            <p>{replacePatientText(card.description, useClientTerminology)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Home;
