// The API is on a different site than the frontend (vercel.app vs onrender.com),
// so a session cookie would be third-party and blocked by Safari/Firefox/Chrome.
// The bearer token therefore lives in localStorage and is sent explicitly.
const TOKEN_KEY = "zoom-clone.auth-token";

export const AUTH_EXPIRED_EVENT = "zoom-clone:auth-expired";

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};
