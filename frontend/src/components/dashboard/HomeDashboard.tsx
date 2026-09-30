"use client";

import { CalendarDays, MonitorUp, Plus, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { JoinMeetingForm } from "@/components/join/JoinMeetingForm";
import { MeetingList } from "@/components/meetings/MeetingList";
import { useMeetingDialogs } from "@/components/meetings/useMeetingDialogs";
import { Modal } from "@/components/ui/Modal";
import { useMeetingLists } from "@/hooks/useMeetingLists";
import { useStartInstantMeeting } from "@/hooks/useStartInstantMeeting";
import { cn } from "@/lib/cn";
import { supportsScreenShare } from "@/lib/device";
import { ActionTile } from "./ActionTile";
import { ClockBanner } from "./ClockBanner";

type JoinIntent = "join" | "share" | null;

export function HomeDashboard() {
  const lists = useMeetingLists();
  const { actions, dialogs } = useMeetingDialogs(lists.refresh);
  const { start, starting } = useStartInstantMeeting();
  const [joinIntent, setJoinIntent] = useState<JoinIntent>(null);
  // Only rendered client-side (behind RequireAuth), so reading navigator here is safe.
  const [canShareScreen] = useState(supportsScreenShare);

  return (
    <main className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:py-14 short:gap-5 short:py-4">
      {/* Left: primary actions */}
      <section aria-label="Meeting actions" className="flex items-start justify-center lg:pt-16">
        <div
          className={cn(
            "grid gap-x-10 gap-y-8 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-12 short:gap-y-4",
            canShareScreen ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 gap-x-6 sm:gap-x-10",
          )}
        >
          <ActionTile label="New Meeting" tone="orange" onClick={start} loading={starting} icon={<Video className="size-9" />} />
          <ActionTile label="Join" tone="blue" onClick={() => setJoinIntent("join")} icon={<Plus className="size-10" />} />
          <ActionTile label="Schedule" tone="blue" onClick={actions.schedule} icon={<CalendarDays className="size-9" />} />
          {canShareScreen && (
            <ActionTile label="Share Screen" tone="blue" onClick={() => setJoinIntent("share")} icon={<MonitorUp className="size-9" />} />
          )}
        </div>
      </section>

      {/* Right: clock + upcoming, then recent */}
      <div className="flex flex-col gap-6">
        <section aria-labelledby="upcoming-heading" className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <ClockBanner />
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <h2 id="upcoming-heading" className="font-bold text-ink">
              Upcoming Meetings
            </h2>
            <Link href="/meetings" className="text-sm font-bold text-zoom-blue hover:underline">
              View all
            </Link>
          </div>
          <div className="scrollbar-thin max-h-[340px] overflow-y-auto px-2 pb-3">
            <MeetingList
              variant="upcoming"
              meetings={lists.upcoming}
              loading={lists.loading}
              error={lists.error}
              onRetry={lists.refresh}
              actions={actions}
            />
          </div>
        </section>

        <section aria-labelledby="recent-heading" className="rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <h2 id="recent-heading" className="font-bold text-ink">
              Recent Meetings
            </h2>
            <Link href="/meetings?tab=previous" className="text-sm font-bold text-zoom-blue hover:underline">
              View all
            </Link>
          </div>
          <div className="scrollbar-thin max-h-[320px] overflow-y-auto px-2 pb-3">
            <MeetingList
              variant="recent"
              meetings={lists.recent}
              loading={lists.loading}
              error={lists.error}
              onRetry={lists.refresh}
              actions={actions}
            />
          </div>
        </section>
      </div>

      <Modal open={joinIntent !== null} onClose={() => setJoinIntent(null)} title={joinIntent === "share" ? "Share Screen" : "Join Meeting"}>
        {joinIntent === "share" && (
          <p className="mb-4 rounded-lg bg-zoom-blue-soft px-4 py-3 text-sm text-ink">
            Join the meeting you want to share to, then click <b>Share Screen</b> in the meeting controls.
          </p>
        )}
        <JoinMeetingForm onCancel={() => setJoinIntent(null)} />
      </Modal>
      {dialogs}
    </main>
  );
}
