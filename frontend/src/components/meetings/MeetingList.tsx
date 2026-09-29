"use client";

import { AlertCircle, CalendarDays, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClock } from "@/hooks/useClock";
import type { Meeting } from "@/types/meeting";
import { MeetingListItem } from "./MeetingListItem";
import type { MeetingActions } from "./useMeetingDialogs";

interface MeetingListProps {
  meetings: Meeting[];
  variant: "upcoming" | "recent";
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  actions: MeetingActions;
}

function SkeletonRows() {
  return (
    <ul aria-hidden className="flex flex-col gap-2 px-3 py-2">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex animate-pulse items-center gap-3 py-2">
          <div className="h-8 w-16 rounded bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-line" />
            <div className="h-3 w-1/3 rounded bg-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Loading / error / empty / list states for a list of meetings. */
export function MeetingList({ meetings, variant, loading, error, onRetry, actions }: MeetingListProps) {
  const now = useClock(30_000) ?? new Date();

  if (loading && !meetings.length) return <SkeletonRows />;

  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-6" />}
        title="Couldn't load meetings"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!meetings.length) {
    return variant === "upcoming" ? (
      <EmptyState
        icon={<CalendarDays className="size-6" />}
        title="No upcoming meetings"
        description="Schedule a meeting and it will show up here."
        action={
          <Button size="sm" onClick={actions.schedule}>
            Schedule a meeting
          </Button>
        }
      />
    ) : (
      <EmptyState icon={<History className="size-6" />} title="No recent meetings" description="Meetings you host or join will appear here." />
    );
  }

  return (
    <ul className="flex flex-col">
      {meetings.map((meeting) => (
        <MeetingListItem key={meeting.meeting_code} meeting={meeting} variant={variant} actions={actions} now={now} />
      ))}
    </ul>
  );
}
