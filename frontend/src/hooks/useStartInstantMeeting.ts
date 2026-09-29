"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { useToast } from "@/providers/ToastProvider";

/** "New Meeting": create an instant meeting and send the host to its room. */
export function useStartInstantMeeting() {
  const router = useRouter();
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const meeting = await meetingsApi.createInstant();
      router.push(`/meeting/${meeting.meeting_code}?host=1`);
    } catch (err) {
      toast.error(errorMessage(err));
      setStarting(false);
    }
  }, [router, toast]);

  return { start, starting };
}
