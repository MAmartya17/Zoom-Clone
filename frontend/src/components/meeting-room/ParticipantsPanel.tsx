"use client";

import { Mic, MicOff, MoreHorizontal, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu } from "@/components/ui/Menu";
import type { RoomParticipant } from "@/types/realtime";
import { SidePanel } from "./SidePanel";

interface ParticipantsPanelProps {
  participants: RoomParticipant[];
  selfId: number | null;
  isHost: boolean;
  onClose: () => void;
  onInvite: () => void;
  onMuteAll: () => void;
  onMuteParticipant: (id: number) => void;
  onRemoveParticipant: (id: number) => void;
}

function roleLabel(participant: RoomParticipant, isSelf: boolean): string | null {
  const tags = [participant.role === "host" && "Host", isSelf && "me"].filter(Boolean);
  return tags.length ? `(${tags.join(", ")})` : null;
}

export function ParticipantsPanel({
  participants,
  selfId,
  isHost,
  onClose,
  onInvite,
  onMuteAll,
  onMuteParticipant,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const [pendingRemoval, setPendingRemoval] = useState<RoomParticipant | null>(null);
  // Host first, then self, then everyone else in join order (Zoom's ordering).
  const sorted = [...participants].sort((a, b) => {
    const rank = (p: RoomParticipant) => (p.role === "host" ? 0 : p.id === selfId ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onInvite} className="flex-1 rounded-lg border border-room-line py-2 text-sm font-bold hover:bg-room-hover">
            Invite
          </button>
          {isHost && (
            <button onClick={onMuteAll} className="flex-1 rounded-lg border border-room-line py-2 text-sm font-bold hover:bg-room-hover">
              Mute All
            </button>
          )}
        </div>
      }
    >
      <ul className="py-2">
        {sorted.map((participant) => {
          const isSelf = participant.id === selfId;
          const canModerate = isHost && !isSelf;
          return (
            <li key={participant.id} className="group flex items-center gap-3 px-4 py-2 hover:bg-room-hover">
              <Avatar name={participant.display_name} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm">
                {participant.display_name} <span className="text-white/60">{roleLabel(participant, isSelf)}</span>
              </p>
              {canModerate && participant.audio && (
                <button
                  onClick={() => onMuteParticipant(participant.id)}
                  className="hidden rounded-md border border-room-line px-2 py-0.5 text-xs group-hover:block"
                >
                  Mute
                </button>
              )}
              {canModerate && (
                <Menu
                  dark
                  items={[{ label: "Remove", onSelect: () => setPendingRemoval(participant), danger: true }]}
                  trigger={({ toggle }) => (
                    <button onClick={toggle} aria-label={`More options for ${participant.display_name}`} className="rounded p-1 text-white/60 hover:text-white">
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                />
              )}
              {participant.audio ? <Mic className="size-4 text-white/70" /> : <MicOff className="size-4 text-zoom-red" />}
              {participant.video || participant.screen ? (
                <Video className="size-4 text-white/70" />
              ) : (
                <VideoOff className="size-4 text-zoom-red" />
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove participant?"
        message={`Do you want to remove ${pendingRemoval?.display_name ?? "this participant"} from the meeting?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemoval) onRemoveParticipant(pendingRemoval.id);
        }}
        onClose={() => setPendingRemoval(null)}
      />
    </SidePanel>
  );
}
