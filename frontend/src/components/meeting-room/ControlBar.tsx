"use client";

import { MessageSquare, Mic, MicOff, MonitorUp, MonitorX, Users, Video, VideoOff } from "lucide-react";
import type { ReactNode } from "react";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";

interface ControlBarProps {
  audioOn: boolean;
  videoOn: boolean;
  sharing: boolean;
  participantCount: number;
  unreadChat: number;
  activePanel: "participants" | "chat" | null;
  isHost: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: "participants" | "chat") => void;
  onLeave: () => void;
  onEndForAll: () => void;
}

function ControlButton({
  label,
  icon,
  onClick,
  active = false,
  badge,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      // Labels are visually hidden on phones, so the accessible name must not depend on them.
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "relative flex min-w-12 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-white/90 transition-colors hover:bg-room-hover sm:min-w-20 sm:px-3 short:py-1",
        active && "bg-room-hover",
        className,
      )}
    >
      <span className="relative">
        {icon}
        {badge}
      </span>
      <span className="hidden whitespace-nowrap sm:block short:hidden">{label}</span>
    </button>
  );
}

/** Zoom's bottom toolbar: audio/video on the left, collaboration in the middle, leave on the right. */
export function ControlBar(props: ControlBarProps) {
  const { audioOn, videoOn, sharing, participantCount, unreadChat, activePanel, isHost } = props;

  return (
    <footer className="shrink-0 border-t border-room-line bg-room-panel pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-between gap-1 px-2 sm:h-[72px] sm:gap-2 sm:px-4 short:h-12">
      <div className="flex items-center gap-1">
        <ControlButton
          label={audioOn ? "Mute" : "Unmute"}
          onClick={props.onToggleAudio}
          icon={audioOn ? <Mic className="size-6" /> : <MicOff className="size-6 text-zoom-red" />}
        />
        <ControlButton
          label={videoOn ? "Stop Video" : "Start Video"}
          onClick={props.onToggleVideo}
          icon={videoOn ? <Video className="size-6" /> : <VideoOff className="size-6 text-zoom-red" />}
        />
      </div>

      <div className="flex items-center gap-1">
        <ControlButton
          label="Participants"
          active={activePanel === "participants"}
          onClick={() => props.onTogglePanel("participants")}
          icon={<Users className="size-6" />}
          badge={
            <span className="absolute -right-3 -top-1 rounded-full bg-room-hover px-1.5 text-[10px] font-bold leading-4 text-white">
              {participantCount}
            </span>
          }
        />
        <ControlButton
          label="Chat"
          active={activePanel === "chat"}
          onClick={() => props.onTogglePanel("chat")}
          icon={<MessageSquare className="size-6" />}
          badge={
            unreadChat > 0 && (
              <span className="absolute -right-2.5 -top-1 rounded-full bg-zoom-red px-1.5 text-[10px] font-bold leading-4 text-white">
                {unreadChat > 9 ? "9+" : unreadChat}
              </span>
            )
          }
        />
        <ControlButton
          label={sharing ? "Stop Share" : "Share Screen"}
          onClick={props.onToggleShare}
          icon={
            <span className={cn("flex items-center justify-center rounded-md p-1", sharing ? "bg-zoom-red" : "bg-zoom-green")}>
              {sharing ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />}
            </span>
          }
        />
      </div>

      {isHost ? (
        <Menu
          dark
          placement="top"
          items={[
            { label: "End Meeting for All", onSelect: props.onEndForAll, danger: true },
            { label: "Leave Meeting", onSelect: props.onLeave },
          ]}
          trigger={({ toggle }) => <LeaveButton label="End" onClick={toggle} />}
        />
      ) : (
        <LeaveButton label="Leave" onClick={props.onLeave} />
      )}
      </div>
    </footer>
  );
}

function LeaveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg bg-zoom-red px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-zoom-red-hover sm:px-4 short:py-1.5">
      {label}
    </button>
  );
}
