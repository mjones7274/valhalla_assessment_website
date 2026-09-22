import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  FaArrowRight,
  FaBuilding,
  FaClipboardList,
  FaUserInjured,
  FaUsers,
} from "react-icons/fa";

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
      description: "Create, organize, and manage clinical assessments.",
      path: "/assessments",
      icon: FaClipboardList,
      eyebrow: "Clinical library",
    },
    {
      title: "Patients",
      description: "Manage patient records, treatment plans, and assessment progress.",
      path: "/patients",
      icon: FaUserInjured,
      eyebrow: "Patient operations",
    },
    {
      title: "Companies",
      description: "Manage organizations, access, and production settings.",
      path: "/companies",
      icon: FaBuilding,
      eyebrow: "Organizations",
    },
    {
      title: "Users",
      description: "Manage portal access, roles, and company assignments.",
      path: "/users",
      icon: FaUsers,
      eyebrow: "Access management",
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
      return card.path === "/patients" || card.path === "/users";
    }

    return false;
  });

  return (
    <div className="home-container">
      <header className="home-header">
        <p className="home-kicker">Valhalla Assessments</p>
        <h1>Clinical workspace</h1>
        <p className="home-description">
          {replacePatientText(
            "Manage and track assessments, treatment plans, and progress for TBI patients.",
            useClientTerminology
          )}
        </p>
      </header>

      <section className="features" aria-label="Portal sections">
        {cards.map((card, index) => (
          <button
            key={card.path}
            type="button"
            className="feature-card"
            onClick={() => navigate(card.path)}
            style={{ "--home-card-order": index }}
          >
            <span className="feature-card-topline">
              <span className="feature-card-icon" aria-hidden="true">
                <card.icon />
              </span>
              <span className="feature-card-eyebrow">{card.eyebrow}</span>
            </span>
            <span className="feature-card-copy">
              <span className="feature-card-title">
                {replacePatientText(card.title, useClientTerminology)}
              </span>
              <span className="feature-card-description">
                {replacePatientText(card.description, useClientTerminology)}
              </span>
            </span>
            <span className="feature-card-link">
              Open section
              <FaArrowRight aria-hidden="true" />
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}

export default Home;
