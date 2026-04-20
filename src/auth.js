const API_BASE = process.env.REACT_APP_API_URL_BASE;
const SELECTED_COMPANY_SESSION_KEY = "selected_company";
const UI_OPTIONS_SESSION_KEY = "ui_options";
const SESSION_USER_ID_KEY = "session_user_id";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const SESSION_STARTED_AT_KEY = "session_started_at";
const LAST_ACTIVITY_AT_KEY = "last_activity_at";

const REFRESH_PATH = process.env.REACT_APP_AUTH_REFRESH_PATH || "/auth/refresh/";
const REFRESH_USES_COOKIE =
  String(process.env.REACT_APP_AUTH_REFRESH_USES_COOKIE || "true").toLowerCase() === "true";

const DEFAULT_IDLE_TIMEOUT_MINUTES = Number(
  process.env.REACT_APP_IDLE_TIMEOUT_MINUTES || 20
);
const DEFAULT_ABSOLUTE_TIMEOUT_HOURS = Number(
  process.env.REACT_APP_ABSOLUTE_SESSION_HOURS || 12
);
const DEFAULT_REFRESH_SKEW_SECONDS = Number(
  process.env.REACT_APP_TOKEN_REFRESH_SKEW_SECONDS || 120
);

let refreshPromise = null;

const getAccessTokenFromResponse = (data) => {
  if (!data || typeof data !== "object") return null;

  return (
    data?.token?.access?.access_token ??
    data?.token?.access_token ??
    data?.token?.access ??
    data?.access?.access_token ??
    data?.access_token ??
    (typeof data?.token === "string" ? data.token : null)
  );
};

const getRefreshTokenFromResponse = (data) => {
  if (!data || typeof data !== "object") return null;

  return (
    data?.refresh?.refresh_token ??
    data?.refresh_token ??
    (typeof data?.refresh === "string" ? data.refresh : null)
  );
};

/* =========================
   Token helpers
========================= */
export function setToken(token) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return;
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token) {
  if (!token) {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function setSelectedCompany(company) {
  if (!company) {
    sessionStorage.removeItem(SELECTED_COMPANY_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(SELECTED_COMPANY_SESSION_KEY, JSON.stringify(company));
}

export function getSelectedCompany() {
  try {
    const raw = sessionStorage.getItem(SELECTED_COMPANY_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSelectedCompany() {
  sessionStorage.removeItem(SELECTED_COMPANY_SESSION_KEY);
}

export function setUiOptions(uiOptions) {
  if (uiOptions === undefined || uiOptions === null) {
    sessionStorage.removeItem(UI_OPTIONS_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(UI_OPTIONS_SESSION_KEY, JSON.stringify(uiOptions));
}

export function getUiOptions() {
  try {
    const raw = sessionStorage.getItem(UI_OPTIONS_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearUiOptions() {
  sessionStorage.removeItem(UI_OPTIONS_SESSION_KEY);
}

export function setSessionUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    sessionStorage.removeItem(SESSION_USER_ID_KEY);
    return;
  }

  sessionStorage.setItem(SESSION_USER_ID_KEY, normalized);
}

export function getSessionUserId() {
  return String(sessionStorage.getItem(SESSION_USER_ID_KEY) || "").trim() || null;
}

export function clearSessionUserId() {
  sessionStorage.removeItem(SESSION_USER_ID_KEY);
}

export function syncSessionUiOptions(me) {
  const resolvedUserId =
    me?.customer_id ?? me?.user_id ?? me?.id ?? me?.user?.customer_id ?? me?.user?.id ?? null;
  const nextUserId = String(resolvedUserId || "").trim() || null;
  const previousUserId = getSessionUserId();

  if (previousUserId && nextUserId && previousUserId !== nextUserId) {
    clearUiOptions();
  }

  if (nextUserId) {
    setSessionUserId(nextUserId);
  } else {
    clearSessionUserId();
  }

  setUiOptions(me?.ui_options ?? null);
}

export function isAuthenticated() {
  return !!getToken();
}

function decodeJwtPayload(token) {
  if (!token || !token.includes(".")) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function getTokenExpiryTimestampMs(token = getToken()) {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;

  if (!exp || Number.isNaN(Number(exp))) return null;
  return Number(exp) * 1000;
}

export function willTokenExpireSoon(
  minValiditySeconds = DEFAULT_REFRESH_SKEW_SECONDS,
  token = getToken()
) {
  const expiry = getTokenExpiryTimestampMs(token);
  if (!expiry) return false;
  return expiry - Date.now() <= minValiditySeconds * 1000;
}

export function isTokenExpired() {
  const expiry = getTokenExpiryTimestampMs();
  if (!expiry) return false;
  return expiry <= Date.now();
}

export function initializeSessionTimers() {
  const now = Date.now();
  localStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
  localStorage.setItem(LAST_ACTIVITY_AT_KEY, String(now));
}

export function clearSessionTimers() {
  localStorage.removeItem(SESSION_STARTED_AT_KEY);
  localStorage.removeItem(LAST_ACTIVITY_AT_KEY);
}

export function recordUserActivity() {
  localStorage.setItem(LAST_ACTIVITY_AT_KEY, String(Date.now()));
}

export function getSessionStartedAt() {
  const raw = localStorage.getItem(SESSION_STARTED_AT_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

export function getLastActivityAt() {
  const raw = localStorage.getItem(LAST_ACTIVITY_AT_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

export function getIdleTimeoutMs() {
  return Math.max(1, DEFAULT_IDLE_TIMEOUT_MINUTES) * 60 * 1000;
}

export function getAbsoluteSessionTimeoutMs() {
  return Math.max(1, DEFAULT_ABSOLUTE_TIMEOUT_HOURS) * 60 * 60 * 1000;
}

export function isSessionIdle(idleTimeoutMs = getIdleTimeoutMs()) {
  const lastActivity = getLastActivityAt();
  if (!lastActivity) return false;
  return Date.now() - lastActivity >= idleTimeoutMs;
}

export function isSessionPastAbsoluteLimit(
  absoluteTimeoutMs = getAbsoluteSessionTimeoutMs()
) {
  const startedAt = getSessionStartedAt();
  if (!startedAt) return false;
  return Date.now() - startedAt >= absoluteTimeoutMs;
}

export function isSessionExpiredByPolicy() {
  return isSessionIdle() || isSessionPastAbsoluteLimit();
}

/* =========================
   Auth API calls
========================= */
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error("Invalid credentials");
  }

  const data = await res.json();
  const token = getAccessTokenFromResponse(data);
  const refreshToken = getRefreshTokenFromResponse(data);

  if (!token) {
    throw new Error("No token returned from API");
  }

  setToken(token);
  if (refreshToken) {
    setRefreshToken(refreshToken);
  }
  initializeSessionTimers();
  return token;
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const currentRefreshToken = getRefreshToken();

  refreshPromise = (async () => {
    const requestBody = currentRefreshToken
      ? { refresh_token: currentRefreshToken }
      : {};

    if (!currentRefreshToken && !REFRESH_USES_COOKIE) {
      throw new Error("No refresh token available");
    }

    const response = await fetch(`${API_BASE}${REFRESH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      credentials: "include",
    });

    if (!response.ok) {
      clearToken();
      clearRefreshToken();
      throw new Error("Unable to refresh session");
    }

    const data = await response.json();
    const newAccessToken = getAccessTokenFromResponse(data);
    const newRefreshToken = getRefreshTokenFromResponse(data);

    if (!newAccessToken) {
      clearToken();
      clearRefreshToken();
      throw new Error("Refresh response missing access token");
    }

    setToken(newAccessToken);
    if (newRefreshToken) {
      setRefreshToken(newRefreshToken);
    }

    return newAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function getValidAccessToken(minValiditySeconds = DEFAULT_REFRESH_SKEW_SECONDS) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  if (!willTokenExpireSoon(minValiditySeconds, token)) {
    return token;
  }

  return refreshAccessToken();
}

export async function ensureActiveSession(minValiditySeconds = DEFAULT_REFRESH_SKEW_SECONDS) {
  if (isSessionExpiredByPolicy()) {
    throw new Error("Session expired by policy");
  }

  return getValidAccessToken(minValiditySeconds);
}

export async function getMe() {
  const token = await ensureActiveSession();

  let res = await fetch(`${API_BASE}/auth/me/`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) {
    try {
      const refreshedToken = await refreshAccessToken();
      res = await fetch(`${API_BASE}/auth/me/`, {
        headers: {
          "Authorization": `Bearer ${refreshedToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    } catch {
      clearToken();
      clearRefreshToken();
      throw new Error("Unauthorized");
    }
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearToken();
      clearRefreshToken();
    }
    throw new Error("Unauthorized");
  }

  return res.json();
}

export function logout() {
  clearToken();
  clearRefreshToken();
  clearSessionTimers();
  clearSelectedCompany();
  clearUiOptions();
  clearSessionUserId();
}
