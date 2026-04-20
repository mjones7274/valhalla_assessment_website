import { getValidAccessToken, refreshAccessToken, logout } from "./auth";

const API_BASE = process.env.REACT_APP_API_URL_BASE;

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const toUrl = (pathOrUrl) =>
  isAbsoluteUrl(pathOrUrl) ? pathOrUrl : `${API_BASE}${pathOrUrl}`;

export async function apiRequest(pathOrUrl, options = {}) {
  const token = await getValidAccessToken();
  const url = toUrl(pathOrUrl);

  let res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) {
    try {
      const refreshedToken = await refreshAccessToken();
      res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshedToken}`,
          ...options.headers,
        },
        credentials: "include",
      });
    } catch {
      logout();
      throw new Error("Unauthorized");
    }
  }

  return res;
}

export async function apiRequestPublic(pathOrUrl, options = {}) {
  const url = toUrl(pathOrUrl);

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include",
  });
}

export async function apiFetch(pathOrUrl, options = {}) {
  const res = await apiRequest(pathOrUrl, options);

  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
}
