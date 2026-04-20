import React, { useState } from "react";
import * as FaIcons from "react-icons/fa";
import * as AiIcons from "react-icons/ai";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { SidebarData } from "./SidebarData";
import "../App.css";
import { IconContext } from "react-icons";
import { logout } from "../auth";
import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

function Navbar({ loggedIn, setLoggedIn, user, headerAccountLabel }) {
  const [sidebar, setSidebar] = useState(false);
  const navigate = useNavigate();

  const showSidebar = () => setSidebar(!sidebar);

  const handleSignOut = () => {
    logout();
    sessionStorage.clear();
    setSidebar(false);
    setLoggedIn(false);
    navigate("/login");
  };

  const userTypeId = getUserTypeId(user);
  const useClientTerminology = shouldUseClientTerminology(user);

  const filteredSidebarData = SidebarData.filter((item) => {
    if (!loggedIn) return false;

    if (userTypeId === 3) return true;
    if (userTypeId === 2) return item.path === "/" || item.path === "/patients" || item.path === "/users";
    if (userTypeId === 1) return item.path === "/" || item.path === "/patients";

    return false;
  });

  const itemsToShow = loggedIn
    ? [
        ...filteredSidebarData,
        {
          title: "Sign Out",
          path: "#",
          icon: <AiIcons.AiOutlineLogout />,
          cName: "nav-text",
          onClick: handleSignOut,
        },
      ]
    : [
        { title: "Login", path: "/login", icon: <AiIcons.AiOutlineLogin />, cName: "nav-text" },
      ];

  const topNavItems = [...itemsToShow];
  const usersIndex = topNavItems.findIndex((item) => item.path === "/users");
  const companiesIndex = topNavItems.findIndex((item) => item.path === "/companies");
  if (usersIndex !== -1 && companiesIndex !== -1) {
    [topNavItems[usersIndex], topNavItems[companiesIndex]] = [
      topNavItems[companiesIndex],
      topNavItems[usersIndex],
    ];
  }

  return (
    <IconContext.Provider value={{ color: "undefined" }}>
      <div className="navbar">
        <Link
          to="#"
          className={`menu-bars menu-bars-trigger ${loggedIn ? "is-auth" : "is-guest"}`}
          aria-label="Open navigation menu"
        >
          <FaIcons.FaBars onClick={showSidebar} />
        </Link>

        <div className="top-nav-links" aria-label="Primary Navigation">
          <div className="top-nav-links-left">
            {topNavItems.map((item, index) => {
              const label = replacePatientText(item.title, useClientTerminology);

              if (item.onClick) {
                return (
                  <button
                    key={`${item.title}-${index}`}
                    type="button"
                    className="top-nav-link top-nav-action"
                    onClick={item.onClick}
                  >
                    {item.icon}
                    <span>{label}</span>
                  </button>
                );
              }

              return (
                <NavLink
                  key={`${item.path}-${index}`}
                  to={item.path}
                  className={({ isActive }) =>
                    `top-nav-link ${isActive ? "active" : ""}`.trim()
                  }
                >
                  {item.icon}
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>

          {loggedIn && user && (
            <div className="top-nav-links-right">
              <div className="header-account-pill" title={`${user.first_name} ${user.last_name}`}>
                <span className="header-account-name">{user.first_name} {user.last_name}</span>
                {headerAccountLabel && <span className="header-account-role">{headerAccountLabel}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
      <nav className={sidebar ? "nav-menu active" : "nav-menu"}>
        <ul className="nav-menu-items" onClick={showSidebar}>
          <li className="navbar-toggle">
            <Link to="#" className="menu-bars">
              <AiIcons.AiOutlineClose />
            </Link>
          </li>
          {itemsToShow.map((item, index) => (
            <li key={index} className={item.cName}>
              <Link to={item.path} onClick={item.onClick ? item.onClick : null}>
                {item.icon}
                <span>{replacePatientText(item.title, useClientTerminology)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </IconContext.Provider>
  );
}

export default Navbar;
