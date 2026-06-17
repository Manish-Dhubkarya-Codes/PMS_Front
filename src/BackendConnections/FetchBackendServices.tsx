// Updated FetchBackendServices.tsx

import axios from "axios";

const serverURL = import.meta.env.VITE_API_URL ;
console.log('🚀 Axios baseURL being used:', serverURL || '(empty = using Vite proxy)');
// const ACCESS_TOKEN_LIFETIME = 15 * 60 * 1000; // 15 minutes in ms (fallback if no exp)
// const REFRESH_TOKEN_LIFETIME = 7 * 24 * 60 * 60 * 1000; // 7 days in ms (fallback if no exp)

// Global flag to prevent multiple simultaneous refreshes
let isRefreshing = false;
let failedQueue: any[] = [];

// Call this after login success or app load if user logged in
function startAccessTokenRefreshTimer() {
  const expTime = localStorage.getItem('accessTokenExp');
  if (!expTime) return;

  const expirationTime = parseInt(expTime, 10);
  const timeToExpire = expirationTime - Date.now();
  let refreshTime = timeToExpire - 10 * 1000;  // 10s before exp

  if (refreshTime <= 0) {
    refreshTime = 0;  // Refresh immediately if expired or too close
  }

  setTimeout(async () => {
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

  const expirationTime = parseInt(expTime, 10);
  const timeToExpire = expirationTime - Date.now();
  let refreshTime = timeToExpire - 60 * 1000;  // 1 min before exp

  if (refreshTime <= 0) {
    refreshTime = 0;  // Refresh immediately if expired or too close
  }

  setTimeout(async () => {
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
  localStorage.removeItem('role');
  localStorage.removeItem('userData');
  localStorage.removeItem('accessTokenExp');  // Clear exp
  localStorage.removeItem('refreshTokenExp');  // Clear refresh exp
  window.location.href = '/login-reg'; // Forces full reload to clear state
};

// Request interceptor: No manual header attachment (rely on cookies)
api.interceptors.request.use(
  (config) => {
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

    // Skip refresh for login or refresh endpoints to prevent loops
    if (
      error.response?.status === 401 &&
      !originalConfig._retry &&
      originalConfig.url !== '/head/refresh' &&
      !originalConfig.url.includes('check_login')
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
        const refreshResponse = await api.post('/head/refresh');  // Backend sets cookies, returns exps in body
        const { accessExp, refreshExp } = refreshResponse.data;

        // Store new exps (do not store tokens)
        if (accessExp) {
          localStorage.setItem('accessTokenExp', accessExp.toString());
        }
        if (refreshExp) {
          localStorage.setItem('refreshTokenExp', refreshExp.toString());
        }
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
    const refreshResponse = await api.post('/head/refresh', {}, {
      withCredentials: true
    });

    // Update exps from response (backend sends exps)
    const { accessExp, refreshExp } = refreshResponse.data;
    if (accessExp) {
      localStorage.setItem('accessTokenExp', accessExp.toString());
    }
    if (refreshExp) {
      localStorage.setItem('refreshTokenExp', refreshExp.toString());
    }
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
      withCredentials: true
    });
    const data = response.data;
    return data;
  } catch (e) {
    // Let interceptor handle 401
    return null;
  }
};

const getData = async (url: any) => {
  try {
    const response = await api.get(`${url}`, {
      withCredentials: true
    });
    const data = response.data;
    return data;
  } catch (e) {
    // Let interceptor handle 401
    console.error('getData error:', e);
    return null;
  }
};

// Export helper for global use (e.g., in App.js or protected components)
export { serverURL, postData, getData, logoutAndRedirect, startAccessTokenRefreshTimer, startRefreshTokenRefreshTimer };