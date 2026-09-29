"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useMeetingLists } from "@/hooks/useMeetingLists";
import { cn } from "@/lib/cn";
import { MeetingList } from "./MeetingList";
import { useMeetingDialogs } from "./useMeetingDialogs";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "previous", label: "Previous" },
] as const;

/** Zoom's "Meetings" tab: Upcoming / Previous lists with full actions. */
export function MeetingsTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "previous" ? "previous" : "upcoming";
  const lists = useMeetingLists();
  const { actions, dialogs } = useMeetingDialogs(lists.refresh);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-ink">Meetings</h1>
        <Button onClick={actions.schedule}>
          <CalendarPlus className="size-4" /> Schedule a Meeting
        </Button>
      </div>

      <div role="tablist" className="mb-4 flex gap-6 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => router.replace(item.id === "upcoming" ? "/meetings" : "/meetings?tab=previous")}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-bold transition-colors",
              tab === item.id ? "border-zoom-blue text-zoom-blue" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-white p-2 shadow-sm">
        <MeetingList
          variant={tab === "upcoming" ? "upcoming" : "recent"}
          meetings={tab === "upcoming" ? lists.upcoming : lists.recent}
          loading={lists.loading}
          error={lists.error}
          onRetry={lists.refresh}
          actions={actions}
        />
      </section>
      {dialogs}
    </main>
  );
}
