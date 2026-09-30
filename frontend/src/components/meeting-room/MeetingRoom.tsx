"use client";

import { LayoutGrid } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useClock } from "@/hooks/useClock";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { MediaDevices } from "@/hooks/useMediaDevices";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { formatElapsed } from "@/lib/datetime";
import { supportsScreenShare } from "@/lib/device";
import { orderedParticipants, type RoomStatus } from "@/lib/realtime/roomReducer";
import { useToast } from "@/providers/ToastProvider";
import type { JoinSession } from "@/types/meeting";
import type { RoomParticipant } from "@/types/realtime";
import { ChatPanel } from "./ChatPanel";
import { ControlBar } from "./ControlBar";
import { MeetingInfoButton } from "./MeetingInfoButton";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { VideoGrid } from "./VideoGrid";

export type ExitStatus = Exclude<RoomStatus, "connecting" | "connected">;

interface MeetingRoomProps {
  session: JoinSession;
  media: MediaDevices;
  onExit: (status: ExitStatus, reason: string | null) => void;
}

type Panel = "participants" | "chat" | null;

export function MeetingRoom({ session, media, onExit }: MeetingRoomProps) {
  const toast = useToast();
  const copy = useCopyToClipboard();
  const [panel, setPanel] = useState<Panel>(null);
  const [seenMessages, setSeenMessages] = useState(0);
  const [joinedAt] = useState(() => Date.now());
  // Phones can't capture their screen from a browser; hide the button there.
  const [canShareScreen] = useState(supportsScreenShare);
  const now = useClock(1000);
  const isHost = session.participant.role === "host";

  const { state, remoteStreams, actions } = useMeetingRoom({
    session,
    media,
    onForceMuted: (by) => {
      media.setAudioEnabled(false);
      toast.info(`${by} has muted you`);
    },
    onServerError: toast.error,
  });

  useEffect(() => {
    if (state.status !== "connecting" && state.status !== "connected") onExit(state.status, state.exitReason);
  }, [state.status, state.exitReason, onExit]);

  // Chat counts as read while the panel is open.
  useEffect(() => {
    if (panel === "chat") setSeenMessages(state.messages.length);
  }, [panel, state.messages.length]);

  // Zoom keyboard shortcuts: Alt+A mute, Alt+V video.
  const { toggleAudio, toggleVideo } = media;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.code === "KeyA") toggleAudio();
      if (event.code === "KeyV") toggleVideo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleAudio, toggleVideo]);

  const sharing = Boolean(media.screenTrack);
  const selfStream = useMemo(() => {
    const tracks = [media.outgoingVideoTrack, media.audioTrack].filter((t): t is MediaStreamTrack => Boolean(t));
    return tracks.length ? new MediaStream(tracks) : null;
  }, [media.outgoingVideoTrack, media.audioTrack]);

  // Local media state is authoritative for our own tile (no round-trip lag).
  const participants: RoomParticipant[] = orderedParticipants(state).map((p) =>
    p.id === state.selfId ? { ...p, audio: media.audioEnabled, video: media.videoEnabled, screen: sharing } : p,
  );

  const toggleShare = async () => {
    if (sharing) return media.stopScreenShare();
    const other = participants.find((p) => p.screen && p.id !== state.selfId);
    if (other) return toast.info(`${other.display_name} is sharing. Only one participant can share at a time.`);
    const result = await media.startScreenShare();
    if (result === "unsupported") toast.error("Screen sharing isn't supported in this browser. Use Chrome, Edge or Firefox on a computer.");
    if (result === "failed") toast.error("Couldn't start screen sharing. Check your browser's screen-recording permission.");
  };

  const elapsedSince = session.meeting.started_at ? new Date(session.meeting.started_at).getTime() : joinedAt;

  if (state.status === "connecting") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-room text-white">
        <span className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm text-white/70">Connecting to meeting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-room text-white">
      <header className="flex h-11 shrink-0 items-center justify-between px-3 pt-[env(safe-area-inset-top)] short:h-8">
        <div className="flex min-w-0 items-center gap-2">
          <MeetingInfoButton meeting={session.meeting} />
          <span className="truncate text-sm font-bold">{session.meeting.title}</span>
        </div>
        <span className="text-xs tabular-nums text-white/70">{now ? formatElapsed(now.getTime() - elapsedSince) : ""}</span>
        <span className="hidden items-center gap-1.5 text-xs text-white/70 sm:flex">
          <LayoutGrid className="size-4" /> Gallery View
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <VideoGrid participants={participants} selfId={state.selfId} selfStream={selfStream} remoteStreams={remoteStreams} />
        </main>
        {panel === "participants" && (
          <ParticipantsPanel
            participants={participants}
            selfId={state.selfId}
            isHost={isHost}
            onClose={() => setPanel(null)}
            onInvite={() => copy(session.meeting.invite_link, "Invite link copied")}
            onMuteAll={() => {
              actions.muteAll();
              toast.success("All participants have been muted");
            }}
            onMuteParticipant={actions.muteParticipant}
            onRemoveParticipant={actions.removeParticipant}
          />
        )}
        {panel === "chat" && (
          <ChatPanel messages={state.messages} selfId={state.selfId} onSend={actions.sendChat} onClose={() => setPanel(null)} />
        )}
      </div>

      <ControlBar
        audioOn={media.audioEnabled}
        videoOn={media.videoEnabled}
        sharing={sharing}
        canShareScreen={canShareScreen}
        participantCount={participants.length}
        unreadChat={panel === "chat" ? 0 : state.messages.length - seenMessages}
        activePanel={panel}
        isHost={isHost}
        onToggleAudio={() => (media.audioTrack ? toggleAudio() : toast.error("No microphone available."))}
        onToggleVideo={() => (media.cameraTrack ? toggleVideo() : toast.error("No camera available."))}
        onToggleShare={toggleShare}
        onTogglePanel={(target) => setPanel((current) => (current === target ? null : target))}
        onLeave={actions.leave}
        onEndForAll={actions.endMeeting}
      />
    </div>
  );
}
