"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ApiError, errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { useCurrentUser } from "@/providers/AuthProvider";
import type { MeetingPreview } from "@/types/meeting";
import type { ExitStatus } from "./MeetingRoom";
import { MeetingSession } from "./MeetingSession";
import { MeetingStatusScreen } from "./MeetingStatusScreen";
import { loginHref, useReturnPath } from "@/components/auth/RequireAuth";

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; title: string; message: string }
  | { kind: "ready"; preview: MeetingPreview; attempt: number }
  | { kind: "exited"; status: ExitStatus; reason: string | null };

const EXIT_TITLES: Record<ExitStatus, string> = {
  left: "You left the meeting",
  ended: "The meeting has ended",
  removed: "You were removed from the meeting",
  disconnected: "You were disconnected",
};

/** Route controller for /meeting/[code]: validate -> pre-join/room -> exit screen. */
export function MeetingPageClient({ code }: { code: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useCurrentUser();
  const returnPath = useReturnPath();
  const isHost = searchParams.get("host") === "1";
  // Guests may join with just a link; starting a meeting as host requires sign-in.
  const needsSignIn = isHost && !authLoading && !user;

  useEffect(() => {
    if (needsSignIn) router.replace(loginHref(returnPath));
  }, [needsSignIn, router, returnPath]);
  const passcodeFromLink = searchParams.get("pwd") ?? "";
  const nameFromJoinForm = searchParams.get("name") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const load = useCallback(
    async (attempt: number) => {
      setPhase({ kind: "loading" });
      try {
        const preview = await meetingsApi.preview(code);
        setPhase({ kind: "ready", preview, attempt });
      } catch (err) {
        const title = err instanceof ApiError && err.isNotFound ? "Invalid meeting ID" : "Unable to join this meeting";
        setPhase({ kind: "unavailable", title, message: errorMessage(err) });
      }
    },
    [code],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const handleExit = useCallback(
    (status: ExitStatus, reason: string | null) => {
      // The host who ends the meeting goes straight back to Home, like Zoom.
      if (status === "ended" && isHost) router.push("/");
      else setPhase({ kind: "exited", status, reason });
    },
    [isHost, router],
  );

  const spinner = (
    <div className="flex min-h-dvh items-center justify-center bg-room">
      <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  );
  if (isHost && (authLoading || !user)) return spinner;

  switch (phase.kind) {
    case "loading":
      return spinner;
    case "unavailable":
      return <MeetingStatusScreen title={phase.title} message={phase.message} />;
    case "exited": {
      const canRejoin = phase.status === "left" || phase.status === "disconnected";
      return (
        <MeetingStatusScreen
          title={EXIT_TITLES[phase.status]}
          message={phase.reason}
          actions={
            canRejoin && (
              <Button variant="secondary" onClick={() => load(Date.now())}>
                Rejoin
              </Button>
            )
          }
        />
      );
    }
    case "ready":
      return (
        <MeetingSession
          key={phase.attempt}
          preview={phase.preview}
          isHost={isHost}
          initialName={nameFromJoinForm || (isHost ? user?.name ?? "" : "")}
          initialPasscode={passcodeFromLink}
          onExit={handleExit}
        />
      );
  }
}
