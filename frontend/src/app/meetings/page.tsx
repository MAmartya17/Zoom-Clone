import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { TopNav } from "@/components/layout/TopNav";
import { MeetingsTabs } from "@/components/meetings/MeetingsTabs";

export default function MeetingsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <TopNav />
      <Suspense>
        <RequireAuth>
          <MeetingsTabs />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
