"use client";

import { Copy, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { buildInvitationText } from "@/lib/invitation";
import type { Meeting } from "@/types/meeting";

/** Green shield in the top-left that reveals meeting ID, passcode and invite link. */
export function MeetingInfoButton({ meeting }: { meeting: Meeting }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copy = useCopyToClipboard();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((value) => !value)} aria-label="Meeting information" className="rounded p-1 hover:bg-room-hover">
        <ShieldCheck className="size-5 text-zoom-green" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-80 rounded-xl border border-room-line bg-room-panel p-4 text-sm text-white shadow-2xl">
          <p className="mb-3 truncate text-base font-bold">{meeting.title}</p>
          <dl className="grid grid-cols-[96px_1fr] gap-y-2">
            <dt className="text-white/60">Meeting ID</dt>
            <dd>{meeting.formatted_code}</dd>
            <dt className="text-white/60">Host</dt>
            <dd>{meeting.host.name}</dd>
            <dt className="text-white/60">Passcode</dt>
            <dd>{meeting.passcode}</dd>
            <dt className="text-white/60">Invite link</dt>
            <dd className="min-w-0 truncate text-[#6ea0ff]">{meeting.invite_link}</dd>
          </dl>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => copy(meeting.invite_link, "Invite link copied")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zoom-blue py-2 text-xs font-bold hover:bg-zoom-blue-hover"
            >
              <Copy className="size-3.5" /> Copy Link
            </button>
            <button
              onClick={() => copy(buildInvitationText(meeting), "Invitation copied")}
              className="flex-1 rounded-lg border border-room-line py-2 text-xs font-bold hover:bg-room-hover"
            >
              Copy Invitation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
