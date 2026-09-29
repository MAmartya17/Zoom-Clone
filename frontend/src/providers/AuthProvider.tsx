"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, usersApi } from "@/lib/api/users";
import { AUTH_EXPIRED_EVENT, tokenStorage } from "@/lib/auth/tokenStorage";
import type { AuthResponse, User } from "@/types/meeting";

interface AuthState {
  user: User | null;
  /** True until we know whether a stored token is still valid. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from a stored token on first load.
  useEffect(() => {
    if (!tokenStorage.get()) {
      setLoading(false);
      return;
    }
    usersApi
      .me()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from the API (expired/revoked token) signs the user out here.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const startSession = useCallback(({ user: signedIn, token }: AuthResponse) => {
    tokenStorage.set(token);
    setUser(signedIn);
    return signedIn;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => startSession(await authApi.login(email, password)),
    [startSession],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => startSession(await authApi.signup(name, email, password)),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // revoke server-side
    } catch {
      // Already invalid or offline: signing out locally is still correct.
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Convenience for components that only need to read the signed-in user. */
export function useCurrentUser(): Pick<AuthState, "user" | "loading"> {
  const { user, loading } = useAuth();
  return { user, loading };
}
