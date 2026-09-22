import React from "react";
import * as FaIcons from "react-icons/fa";

export const SidebarData = [
  { title: "Home", path: "/", icon: <FaIcons.FaHome />, cName: "nav-text" },
  { title: "Assessments", path: "/assessments", icon: <FaIcons.FaClipboardList />, cName: "nav-text" },
  { title: "Patients", path: "/patients", icon: <FaIcons.FaUserInjured />, cName: "nav-text" },
  { title: "Companies", path: "/companies", icon: <FaIcons.FaBuilding />, cName: "nav-text" },
  { title: "Users", path: "/users", icon: <FaIcons.FaUsers />, cName: "nav-text" }
];
