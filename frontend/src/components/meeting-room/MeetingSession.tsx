"use client";

import { useState } from "react";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import type { JoinSession, MeetingPreview } from "@/types/meeting";
import { MeetingRoom, type ExitStatus } from "./MeetingRoom";
import { PreJoinScreen } from "./PreJoinScreen";

interface MeetingSessionProps {
  preview: MeetingPreview;
  isHost: boolean;
  initialName: string;
  initialPasscode: string;
  onExit: (status: ExitStatus, reason: string | null) => void;
}

/**
 * Pre-join -> in-meeting for one attempt. Media devices are owned here so the
 * camera turns off as soon as this component unmounts (i.e. on exit).
 */
export function MeetingSession({ preview, isHost, initialName, initialPasscode, onExit }: MeetingSessionProps) {
  const media = useMediaDevices({
    // Meeting settings from the scheduler decide the default mic/camera state.
    audio: isHost || !preview.mute_on_entry,
    video: isHost ? preview.host_video_on : preview.participant_video_on,
  });
  const [session, setSession] = useState<JoinSession | null>(null);

  return session ? (
    <MeetingRoom session={session} media={media} onExit={onExit} />
  ) : (
    <PreJoinScreen
      preview={preview}
      isHost={isHost}
      media={media}
      initialName={initialName}
      initialPasscode={initialPasscode}
      onJoined={setSession}
    />
  );
}
