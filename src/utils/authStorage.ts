const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const ACCESS_EXP_KEY = "accessTokenExp";
const REFRESH_EXP_KEY = "refreshTokenExp";
const ROLE_KEY = "role";
const USER_DATA_KEY = "userData";

export function encodeStorageValue(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return btoa(value);
  }
}

export function decodeStorageValue(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    try {
      return atob(value);
    } catch {
      return "";
    }
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function persistAuthTokens(data: {
  accessToken?: string | null;
  refreshToken?: string | null;
  accessExp?: string | number | null;
  refreshExp?: string | number | null;
}): void {
  if (data.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  if (data.accessExp != null && data.accessExp !== "") {
    localStorage.setItem(ACCESS_EXP_KEY, String(data.accessExp));
  }
  if (data.refreshExp != null && data.refreshExp !== "") {
    localStorage.setItem(REFRESH_EXP_KEY, String(data.refreshExp));
  }
}

export function persistAuthSession(params: {
  role: string;
  userData: unknown;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessExp?: string | number | null;
  refreshExp?: string | number | null;
}): void {
  persistAuthTokens(params);
  localStorage.setItem(ROLE_KEY, encodeStorageValue(params.role));
  localStorage.setItem(USER_DATA_KEY, encodeStorageValue(JSON.stringify(params.userData ?? {})));
}

export function readStoredUserData(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY);
    if (!raw) return null;
    const decoded = decodeStorageValue(raw);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function readStoredRole(): string {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return "";
    return decodeStorageValue(raw);
  } catch {
    return "";
  }
}

export function clearAuthStorage(): void {
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  localStorage.removeItem(ACCESS_EXP_KEY);
  localStorage.removeItem(REFRESH_EXP_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
