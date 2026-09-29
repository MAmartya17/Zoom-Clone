"use client";

import { Copy, Info, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatDuration, formatTime, formatTimeRange } from "@/lib/datetime";
import type { Meeting } from "@/types/meeting";
import type { MeetingActions } from "./useMeetingDialogs";

interface MeetingListItemProps {
  meeting: Meeting;
  variant: "upcoming" | "recent";
  actions: MeetingActions;
  now: Date;
}

function isStartingSoon(meeting: Meeting, now: Date): boolean {
  const start = new Date(meeting.start_time).getTime();
  return start - now.getTime() < 10 * 60_000 && new Date(meeting.end_time).getTime() > now.getTime();
}

export function MeetingListItem({ meeting, variant, actions, now }: MeetingListItemProps) {
  const upcoming = variant === "upcoming";
  const menuItems: MenuItem[] = [
    { label: "Copy invitation", icon: <Copy className="size-4" />, onSelect: () => actions.copyInvitation(meeting) },
    { label: "View details", icon: <Info className="size-4" />, onSelect: () => actions.viewDetails(meeting) },
    ...(upcoming
      ? [
          { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => actions.edit(meeting) },
          { label: "Delete", icon: <Trash2 className="size-4" />, onSelect: () => actions.remove(meeting), danger: true },
        ]
      : []),
  ];

  const when = upcoming
    ? formatTimeRange(meeting.start_time, meeting.end_time)
    : formatTime(meeting.started_at ?? meeting.start_time);
  const soon = upcoming && isStartingSoon(meeting, now);

  return (
    <li className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface">
      <div className="w-20 shrink-0 text-xs">
        <p className={cn("font-bold", soon ? "text-zoom-blue" : "text-ink")}>{formatDayLabel(meeting.started_at ?? meeting.start_time, now)}</p>
        <p className="text-ink-muted">{when.split(" - ")[0]}</p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{meeting.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
          <span>{upcoming ? when : formatDuration(meeting.duration_minutes)}</span>
          <span aria-hidden>·</span>
          <span>ID: {meeting.formatted_code}</span>
          {!upcoming && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {meeting.participant_count}
              </span>
              {meeting.status === "live" && <span className="rounded bg-zoom-green/10 px-1.5 font-bold text-zoom-green">Live</span>}
            </>
          )}
        </p>
      </div>

      {upcoming && (
        <Link
          href={`/meeting/${meeting.meeting_code}?host=1`}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
            soon ? "bg-zoom-blue text-white hover:bg-zoom-blue-hover" : "border border-line text-ink hover:bg-white",
          )}
        >
          Start
        </Link>
      )}

      <Menu
        items={menuItems}
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            aria-label={`More options for ${meeting.title}`}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-white hover:text-ink"
          >
            <MoreHorizontal className="size-4" />
          </button>
        )}
      />
    </li>
  );
}
