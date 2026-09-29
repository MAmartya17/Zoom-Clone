"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import type { Meeting } from "@/types/meeting";

interface MeetingListsState {
  upcoming: Meeting[];
  recent: Meeting[];
  loading: boolean;
  error: string | null;
}

/** Dashboard data: upcoming + recent meetings, refetched after any mutation. */
export function useMeetingLists() {
  const [state, setState] = useState<MeetingListsState>({ upcoming: [], recent: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [upcoming, recent] = await Promise.all([meetingsApi.listUpcoming(), meetingsApi.listRecent()]);
      setState({ upcoming, recent, loading: false, error: null });
    } catch (err) {
      setState((current) => ({ ...current, loading: false, error: errorMessage(err) }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
