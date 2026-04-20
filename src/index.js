import * as React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Outlet, useNavigate, useLocation, Navigate, useOutletContext } from "react-router-dom";
import Activities from "./routes/Activities";
import Families from "./routes/Families";
import Tasks from "./routes/Tasks";
import Goals from "./routes/Goals";
import Priorities from "./routes/Priorities";
import Home from "./routes/Home";
import Navbar from "./components/Navbar";
import Login from "./routes/Login";
import Users from "./routes/Users";
import Assessments from "./routes/Assessments";
import Patients from "./routes/Patients";
import Companies from "./routes/Companies";
import AssessmentDetails from "./routes/AssessmentDetails";
import TakeAssessment from "./routes/TakeAssessment";
import { apiRequest } from "./api";
import {
  clearSelectedCompany,
  ensureActiveSession,
  getMe,
  getSelectedCompany,
  initializeSessionTimers,
  isAuthenticated,
  isSessionExpiredByPolicy,
  logout,
  refreshAccessToken,
  recordUserActivity,
  setSelectedCompany,
  syncSessionUiOptions,
} from "./auth";

import "./App.css";

const ADMIN_COMPANY_ID = 1;
const ADMIN_COMPANY_API = `${process.env.REACT_APP_API_URL_BASE}/api/companies/${ADMIN_COMPANY_ID}/`;
const SESSION_EXPIRY_COUNTDOWN_SECONDS = Number(
  process.env.REACT_APP_SESSION_EXPIRY_COUNTDOWN_SECONDS || 30
);

const getCompanyKey = (company) =>
  String(
    company?.company_id ??
    company?.id ??
    company?.company_name ??
    company?.name ??
    ""
  );

const normalizeAssociatedCompanies = (me) => {
  const candidateSources = [
    me?.companies,
    me?.user_companies,
    me?.associated_companies,
  ];

  if (me?.company) {
    candidateSources.push([me.company]);
  }

  const flattened = candidateSources
    .flatMap((source) => (Array.isArray(source) ? source : []))
    .map((item) => item?.company ?? item)
    .filter(Boolean);

  const seen = new Set();
  return flattened.filter((company) => {
    const key = getCompanyKey(company);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getUserTypeId = (user) =>
  Number(user?.user_type_id ?? user?.user_type?.user_type_id ?? user?.user_type?.id ?? 0);

const canAccessPath = (userTypeId, pathname) => {
  if (userTypeId === 3) return true;

  if (userTypeId === 2) {
    return pathname === "/" || pathname === "/patients" || pathname === "/users";
  }

  if (userTypeId === 1) {
    return pathname === "/" || pathname === "/patients";
  }

  return false;
};

const AppHeader = ({ loggedIn, setLoggedIn, user }) => {
  const userTypeId = getUserTypeId(user);
  const showApiUrl = process.env.NODE_ENV === "development";
  const selectedCompany = loggedIn ? getSelectedCompany() : null;
  const selectedCompanyName =
    selectedCompany?.company_name ?? selectedCompany?.name ?? "";
  const headerAccountLabel = userTypeId === 3 ? "Admin" : selectedCompanyName;

  return (
    <header className="app-header">
      <div className="header-top-row">
        <Navbar
          loggedIn={loggedIn}
          setLoggedIn={setLoggedIn}
          user={user}
          headerAccountLabel={headerAccountLabel}
        />
      </div>

      <div className="header-copy">
        <h1 className="header-title">Valhalla TBI Portal</h1>
        <p className="header-subtitle">Specialized in TBI Treatment and Assessment</p>
        {showApiUrl && (
          <p className="header-api-url">
            API: {process.env.REACT_APP_API_URL_BASE}
          </p>
        )}
      </div>
    </header>
  );
};

const AppLayout = () => {
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [showSessionExpiredModal, setShowSessionExpiredModal] = React.useState(false);
  const [sessionExpiryCountdown, setSessionExpiryCountdown] = React.useState(
    SESSION_EXPIRY_COUNTDOWN_SECONDS
  );
  const [refreshingSession, setRefreshingSession] = React.useState(false);
  const [showCompanySelectModal, setShowCompanySelectModal] = React.useState(false);
  const [companyOptions, setCompanyOptions] = React.useState([]);
  const [selectedCompanyKey, setSelectedCompanyKey] = React.useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const hideChrome = location.pathname.startsWith("/take-assessment/");
  const expiredDialogShownRef = React.useRef(false);
  const lastActivityRecordedAtRef = React.useRef(0);

  const forceLogoutToLogin = React.useCallback(() => {
    logout();
    sessionStorage.clear();
    setLoggedIn(false);
    setUser(null);
    setShowSessionExpiredModal(false);
    setSessionExpiryCountdown(SESSION_EXPIRY_COUNTDOWN_SECONDS);
    setRefreshingSession(false);
    setShowCompanySelectModal(false);
    setCompanyOptions([]);
    setSelectedCompanyKey("");
    expiredDialogShownRef.current = false;
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleSessionExpired = React.useCallback(() => {
    if (expiredDialogShownRef.current) return;
    expiredDialogShownRef.current = true;

    setSessionExpiryCountdown(SESSION_EXPIRY_COUNTDOWN_SECONDS);
    setShowSessionExpiredModal(true);
  }, []);

  const syncSelectedCompanyForUser = React.useCallback(async (me) => {
    const userTypeId = getUserTypeId(me);

    if (userTypeId === 3) {
      try {
        const companyRes = await apiRequest(ADMIN_COMPANY_API);
        const companyData = await companyRes.json();

        if (companyData && typeof companyData === "object") {
          setSelectedCompany(companyData);
        } else {
          clearSelectedCompany();
        }
      } catch (error) {
        console.error("Failed to load admin company context", error);
        clearSelectedCompany();
      }

      setShowCompanySelectModal(false);
      setCompanyOptions([]);
      setSelectedCompanyKey("");
      return;
    }

    const associatedCompanies = normalizeAssociatedCompanies(me);

    if (associatedCompanies.length === 0) {
      clearSelectedCompany();
      setShowCompanySelectModal(false);
      setCompanyOptions([]);
      setSelectedCompanyKey("");
      return;
    }

    if (associatedCompanies.length === 1) {
      setSelectedCompany(associatedCompanies[0]);
      setShowCompanySelectModal(false);
      setCompanyOptions([]);
      setSelectedCompanyKey("");
      return;
    }

    const storedCompany = getSelectedCompany();
    const storedKey = storedCompany ? getCompanyKey(storedCompany) : "";
    const matchedStoredCompany = associatedCompanies.find(
      (company) => getCompanyKey(company) === storedKey
    );

    if (matchedStoredCompany) {
      setSelectedCompany(matchedStoredCompany);
      setShowCompanySelectModal(false);
      setCompanyOptions([]);
      setSelectedCompanyKey("");
      return;
    }

    clearSelectedCompany();
    setCompanyOptions(associatedCompanies);
    setSelectedCompanyKey("");
    setShowCompanySelectModal(true);
  }, []);

  const handleConfirmCompanySelection = React.useCallback(() => {
    if (!selectedCompanyKey) return;

    const selectedCompany = companyOptions.find(
      (company) => getCompanyKey(company) === selectedCompanyKey
    );

    if (!selectedCompany) return;

    setSelectedCompany(selectedCompany);
    setShowCompanySelectModal(false);
  }, [companyOptions, selectedCompanyKey]);

  const handleCancelCompanySelection = React.useCallback(() => {
    logout();
    sessionStorage.clear();
    setLoggedIn(false);
    setUser(null);
    setShowCompanySelectModal(false);
    setCompanyOptions([]);
    setSelectedCompanyKey("");
    navigate("/login", { replace: true });
  }, [navigate]);

  const acknowledgeSessionExpired = React.useCallback(() => {
    forceLogoutToLogin();
  }, [forceLogoutToLogin]);

  const handleKeepWorking = React.useCallback(async () => {
    setRefreshingSession(true);
    try {
      await refreshAccessToken();
      initializeSessionTimers();
      recordUserActivity();
      expiredDialogShownRef.current = false;
      setSessionExpiryCountdown(SESSION_EXPIRY_COUNTDOWN_SECONDS);
      setShowSessionExpiredModal(false);
    } catch {
      forceLogoutToLogin();
    } finally {
      setRefreshingSession(false);
    }
  }, [forceLogoutToLogin]);

  const recordThrottledActivity = React.useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRecordedAtRef.current < 15000) return;

    lastActivityRecordedAtRef.current = now;
    recordUserActivity();
  }, []);

  React.useEffect(() => {
    if (location.pathname !== "/login" && isSessionExpiredByPolicy()) {
      handleSessionExpired();
      return;
    }

    if (isAuthenticated()) {
      ensureActiveSession()
        .then(() => getMe())
        .then(async (me) => {
          syncSessionUiOptions(me);
          setUser(me);
          setLoggedIn(true);
          recordThrottledActivity();
          expiredDialogShownRef.current = false;
          setShowSessionExpiredModal(false);
          await syncSelectedCompanyForUser(me);

          // optional if you still want these for UI
          // sessionStorage.setItem("first_name", me.first_name);
          // sessionStorage.setItem("last_name", me.last_name);
        })
        .catch(() => {
          if (location.pathname !== "/login") {
            handleSessionExpired();
          } else {
            logout();
            setLoggedIn(false);
            setUser(null);
          }
        });
    }
  }, [location.pathname, handleSessionExpired, recordThrottledActivity, syncSelectedCompanyForUser]);

  React.useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    const handleActivityEvent = () => {
      if (isAuthenticated()) {
        recordThrottledActivity();
      }
    };

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivityEvent, { passive: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivityEvent);
      });
    };
  }, [recordThrottledActivity]);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      if (location.pathname === "/login" || !isAuthenticated()) {
        return;
      }

      if (isSessionExpiredByPolicy()) {
        handleSessionExpired();
        return;
      }

      ensureActiveSession().catch(() => {
        handleSessionExpired();
      });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [location.pathname, handleSessionExpired]);

  React.useEffect(() => {
    if (!showSessionExpiredModal) return;

    if (sessionExpiryCountdown <= 0) {
      forceLogoutToLogin();
      return;
    }

    const timeoutId = setTimeout(() => {
      setSessionExpiryCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [showSessionExpiredModal, sessionExpiryCountdown, forceLogoutToLogin]);

  return (
    <>
      {!hideChrome && (
        <AppHeader
          loggedIn={loggedIn}
          setLoggedIn={setLoggedIn}
          user={user}
          setUser={setUser}
        />
      )}

      <div style={{ paddingTop: hideChrome ? 0 : "20px" }}>
        <Outlet context={{ loggedIn, setLoggedIn, user, setUser }} />
      </div>

      {showSessionExpiredModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1400,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "24px",
              width: "440px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginBottom: "12px", color: "#dc3545" }}>
              Session Expiring
            </h3>

            <p style={{ marginBottom: "20px", color: "#444" }}>
              Your session will expire in {sessionExpiryCountdown} second{sessionExpiryCountdown === 1 ? "" : "s"}.
              Click Keep Working to refresh your session.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: refreshingSession ? "not-allowed" : "pointer",
                  opacity: refreshingSession ? 0.7 : 1,
                }}
                onClick={handleKeepWorking}
                disabled={refreshingSession}
              >
                {refreshingSession ? "Refreshing..." : "Keep Working"}
              </button>
              <button
                style={{
                  background: "#dc3545",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onClick={acknowledgeSessionExpired}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompanySelectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1450,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "24px",
              width: "460px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ marginBottom: "12px", color: "#111827" }}>
              Select Company
            </h3>

            <p style={{ marginBottom: "12px", color: "#444" }}>
              Please select the company you want to work with for this session.
            </p>

            <select
              value={selectedCompanyKey}
              onChange={(e) => setSelectedCompanyKey(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginBottom: "20px",
                borderRadius: "4px",
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Select company</option>
              {companyOptions.map((company) => {
                const key = getCompanyKey(company);
                const label = company.company_name ?? company.name ?? key;
                return (
                  <option key={key} value={key}>
                    {label}
                  </option>
                );
              })}
            </select>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={handleCancelCompanySelection}>Cancel</button>
              <button
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: selectedCompanyKey ? "pointer" : "not-allowed",
                  opacity: selectedCompanyKey ? 1 : 0.6,
                }}
                disabled={!selectedCompanyKey}
                onClick={handleConfirmCompanySelection}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const RequireAuth = () => {
  const appContext = useOutletContext() || {};
  const { loggedIn, user } = appContext;
  const location = useLocation();
  const hasValidToken = isAuthenticated() && !isSessionExpiredByPolicy();

  if (!loggedIn && !hasValidToken) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <Outlet context={appContext} />;
  }

  const userTypeId = getUserTypeId(user);
  if (!canAccessPath(userTypeId, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet context={appContext} />;
};


const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "login", element: <Login /> },
      { path: "take-assessment/:token", element: <TakeAssessment /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <Home /> },
          { path: "assessments", element: <Assessments /> },
          { path: "assessment-details", element: <AssessmentDetails /> },
          { path: "assessment-details/:id", element: <AssessmentDetails /> },
          { path: "activities", element: <Activities /> },
          { path: "tasks", element: <Tasks /> },
          { path: "goals", element: <Goals /> },
          { path: "priorities", element: <Priorities /> },
          { path: "families", element: <Families /> },
          { path: "users", element: <Users /> },
          { path: "patients", element: <Patients /> },
          { path: "companies", element: <Companies /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />);
