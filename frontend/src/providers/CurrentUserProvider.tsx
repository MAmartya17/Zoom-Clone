"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usersApi } from "@/lib/api/users";
import type { User } from "@/types/meeting";

interface CurrentUserState {
  user: User | null;
  loading: boolean;
}

const CurrentUserContext = createContext<CurrentUserState>({ user: null, loading: true });

/**
 * Loads the signed-in user once for the whole app. Today the backend returns
 * the default user; adding real auth only changes how /users/me is resolved.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    usersApi
      .me()
      .then((user) => active && setState({ user, loading: false }))
      .catch(() => active && setState({ user: null, loading: false }));
    return () => {
      active = false;
    };
  }, []);

  return <CurrentUserContext.Provider value={state}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext);
}
