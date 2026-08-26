// Updated FetchBackendServices.tsx

import axios from "axios";
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  persistAuthTokens,
} from "../utils/authStorage";

const serverURL = 'http://localhost:3000';
console.log('🚀 Axios baseURL being used:', serverURL || '(empty = using Vite proxy)');

// Global flag to prevent multiple simultaneous refreshes
let isRefreshing = false;
let failedQueue: any[] = [];
let accessRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTokenTimer: ReturnType<typeof setTimeout> | null = null;

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function persistTokenResponse(data: any) {
  if (!data) return;
  persistAuthTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessExp: data.accessExp,
    refreshExp: data.refreshExp,
  });
}

function shouldSkipAuthRefresh(url?: string) {
  const path = String(url || "");
  return (
    path.includes("check_login") ||
    path.includes("/refresh") ||
    path.includes("register_") ||
    path.includes("verify_") ||
    path.includes("password_reset") ||
    path.includes("reset_password") ||
    path.includes("logout")
  );
}

// Call this after login success or app load if user logged in
function startAccessTokenRefreshTimer() {
  const expTime = localStorage.getItem('accessTokenExp');
  if (!expTime) return;
  if (accessRefreshTimer) clearTimeout(accessRefreshTimer);

  const expirationTime = parseInt(expTime, 10);
  const timeToExpire = expirationTime - Date.now();
  let refreshTime = timeToExpire - 10 * 1000;  // 10s before exp

  if (refreshTime <= 0) {
    refreshTime = 0;  // Refresh immediately if expired or too close
  }

  accessRefreshTimer = setTimeout(async () => {
    try {
      await refreshAccessToken();
      console.log('Access token refreshed via timer');
    } catch (err) {
      console.error('Error refreshing access token', err);
    }
  }, refreshTime);
}

// New: Timer for refreshing the refresh token 1 min before expiry
function startRefreshTokenRefreshTimer() {
  const expTime = localStorage.getItem('refreshTokenExp');
  if (!expTime) return;
  if (refreshTokenTimer) clearTimeout(refreshTokenTimer);

  const expirationTime = parseInt(expTime, 10);
  const timeToExpire = expirationTime - Date.now();
  let refreshTime = timeToExpire - 60 * 1000;  // 1 min before exp

  if (refreshTime <= 0) {
    refreshTime = 0;  // Refresh immediately if expired or too close
  }

  refreshTokenTimer = setTimeout(async () => {
    try {
      await refreshAccessToken();
      console.log('Refresh token refreshed via timer');
    } catch (err) {
      console.error('Error refreshing refresh token', err);
    }
  }, refreshTime);
}

// Create Axios instance with interceptors for JWT
const api = axios.create({
  baseURL: serverURL,
  withCredentials: true,
});

// Helper function to clear auth and redirect (reusable)
const logoutAndRedirect = () => {
  clearAuthStorage();
  window.location.href = '/login-reg'; // Forces full reload to clear state
};

// Request interceptor: cookies when allowed, Bearer token when browsers block them
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      const headers: any = config.headers;
      if (headers) {
        if (typeof headers.delete === "function") {
          headers.delete("Content-Type");
        } else {
          delete headers["Content-Type"];
          delete headers["content-type"];
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;
    if (!originalConfig) return Promise.reject(error);

    // Skip refresh for login or refresh endpoints to prevent loops
    if (
      error.response?.status === 401 &&
      !originalConfig._retry &&
      !shouldSkipAuthRefresh(originalConfig.url)
    ) {
      originalConfig._retry = true;

      if (isRefreshing) {
        // Queue the request if refresh is already in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalConfig });
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await api.post('/head/refresh', {
          refreshToken: getRefreshToken(),
        }, {
          withCredentials: true,
        });
        persistTokenResponse(refreshResponse.data);

        // Process queued requests
        failedQueue.forEach(({ resolve, config }) => {
          resolve(api(config));
        });
        failedQueue = [];

        // Restart timers with new exps
        startAccessTokenRefreshTimer();
        startRefreshTokenRefreshTimer();

        return api(originalConfig);  // Retry original request
      } catch (refreshError) {
        console.error('Refresh failed:', refreshError);
        // Reject queued requests
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        logoutAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

async function refreshAccessToken() {
  try {
    const refreshResponse = await api.post('/head/refresh', {
      refreshToken: getRefreshToken(),
    }, {
      withCredentials: true
    });

    persistTokenResponse(refreshResponse.data);
    startAccessTokenRefreshTimer(); // Restart timer with new exp
    startRefreshTokenRefreshTimer(); // Restart refresh timer with new exp
  } catch (e) {
    console.log('❌ Refresh failed, please login again.', e);
    logoutAndRedirect();
  }
}

const postData = async (url: any, body: any) => {
  try {
    const response = await api.post(`${url}`, body, {
      withCredentials: true,
    });
    const data = response.data;
    return data;
  } catch (e: any) {
    // Keep the backend message so login/register can show pending-approval etc.
    if (e?.response?.data) return e.response.data;
    return null;
  }
};

const postFile = async (url: string, formData: FormData) => {
  try {
    const response = await fetch(`${serverURL}/${String(url).replace(/^\//, "")}`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: authHeaders(),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return data || { status: false, message: `Upload failed (${response.status})` };
    }
    return data;
  } catch (e) {
    console.error("postFile error:", e);
    return { status: false, message: "Upload failed. Please try again." };
  }
};

const getData = async (url: any) => {
  try {
    const response = await api.get(`${url}`, {
      withCredentials: true
    });
    const data = response.data;
    return data;
  } catch (e: any) {
    // Let interceptor handle 401
    console.error('getData error:', e);
    if (e?.response?.data) return e.response.data;
    return null;
  }
};

// Export helper for global use (e.g., in App.js or protected components)
export { serverURL, postData, postFile, getData, logoutAndRedirect, startAccessTokenRefreshTimer, startRefreshTokenRefreshTimer, authHeaders };