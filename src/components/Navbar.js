import React, { useState } from "react";
import * as FaIcons from "react-icons/fa";
import * as AiIcons from "react-icons/ai";
import { NavLink, useNavigate } from "react-router-dom";
import { SidebarData } from "./SidebarData";
import "../App.css";
import { IconContext } from "react-icons";
import { logout } from "../auth";
import { replacePatientText, shouldUseClientTerminology } from "../uiTerminology";

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

function Navbar({ loggedIn, setLoggedIn, user, headerAccountLabel, selectedCompany }) {
  const [sidebar, setSidebar] = useState(false);
  const navigate = useNavigate();

  const showSidebar = () => setSidebar((isOpen) => !isOpen);
  const closeSidebar = () => setSidebar(false);

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
    if (userTypeId === 1) return item.path === "/" || item.path === "/patients" || item.path === "/users";

    return false;
  });

  const mobileItems = loggedIn
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
        { title: "Sign in", path: "/login", icon: <AiIcons.AiOutlineLogin />, cName: "nav-text" },
      ];

  const topNavItems = loggedIn
    ? filteredSidebarData
    : mobileItems;
  const userInitials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((name) => name.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <IconContext.Provider value={{ color: "undefined" }}>
      <div className="navbar">
        <button
          type="button"
          className={`menu-bars menu-bars-trigger ${loggedIn ? "is-auth" : "is-guest"}`}
          aria-label="Open navigation menu"
          aria-expanded={sidebar}
          aria-controls="mobile-navigation"
          onClick={showSidebar}
        >
          <FaIcons.FaBars />
        </button>

        {loggedIn && Boolean(selectedCompany?.api_test_mode) && (
          <span className="api-test-mode-pill api-test-mode-pill-mobile">API Test Mode</span>
        )}

        <nav className="top-nav-links" aria-label="Primary navigation">
          <div className="top-nav-links-left">
            {topNavItems.map((item, index) => {
              const label = replacePatientText(item.title, useClientTerminology);

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
              {Boolean(selectedCompany?.api_test_mode) && (
                <span className="api-test-mode-pill">API Test Mode</span>
              )}
              <div className="header-account-pill" title={`${user.first_name} ${user.last_name}`}>
                <span className="header-account-avatar" aria-hidden="true">{userInitials}</span>
                <span className="header-account-copy">
                  <span className="header-account-name">{user.first_name} {user.last_name}</span>
                  {headerAccountLabel && <span className="header-account-role">{headerAccountLabel}</span>}
                </span>
              </div>
              <button
                type="button"
                className="top-nav-action"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <AiIcons.AiOutlineLogout />
              </button>
            </div>
          )}
        </nav>
      </div>
      <button
        type="button"
        className={sidebar ? "nav-menu-backdrop active" : "nav-menu-backdrop"}
        onClick={closeSidebar}
        aria-label="Close navigation menu"
        tabIndex={sidebar ? 0 : -1}
      />
      <nav
        id="mobile-navigation"
        className={sidebar ? "nav-menu active" : "nav-menu"}
        aria-label="Mobile navigation"
        aria-hidden={!sidebar}
      >
        <div className="mobile-nav-header">
          <img src={`${process.env.PUBLIC_URL}/favicon.ico`} alt="" />
          <span>Valhalla Assessments</span>
          <button type="button" className="mobile-nav-close" onClick={closeSidebar} aria-label="Close navigation menu">
            <AiIcons.AiOutlineClose />
          </button>
        </div>
        {loggedIn && user && (
          <div className="mobile-nav-account">
            <span className="header-account-avatar" aria-hidden="true">{userInitials}</span>
            <span className="header-account-copy">
              <span className="header-account-name">{user.first_name} {user.last_name}</span>
              {headerAccountLabel && <span className="header-account-role">{headerAccountLabel}</span>}
            </span>
          </div>
        )}
        <ul className="nav-menu-items">
          {mobileItems.map((item, index) => (
            <li key={`${item.title}-${index}`} className={item.cName}>
              {item.onClick ? (
                <button type="button" onClick={item.onClick}>
                  {item.icon}
                  <span>{replacePatientText(item.title, useClientTerminology)}</span>
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={closeSidebar}
                  className={({ isActive }) => isActive ? "active" : ""}
                >
                  {item.icon}
                  <span>{replacePatientText(item.title, useClientTerminology)}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </IconContext.Provider>
  );
}

export default Navbar;
