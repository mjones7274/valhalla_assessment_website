import React from "react";
import * as FaIcons from "react-icons/fa";
import * as AiIcons from "react-icons/ai";
import * as IoIcons from "react-icons/io";

export const SidebarData = [
  { title: "Home", path: "/", icon: <AiIcons.AiFillHome />, cName: "nav-text" },
  { title: "Assessments", path: "/assessments", icon: <FaIcons.FaCar />, cName: "nav-text" },
  { title: "Patients", path: "/patients", icon: <IoIcons.IoMdPeople />, cName: "nav-text" },
  { title: "Users", path: "/users", icon: <IoIcons.IoMdPeople />, cName: "nav-text" },
  { title: "Companies", path: "/companies", icon: <IoIcons.IoMdPeople />, cName: "nav-text" }
];
