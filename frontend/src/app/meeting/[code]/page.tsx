import { Suspense } from "react";
import { MeetingPageClient } from "@/components/meeting-room/MeetingPageClient";

export default async function MeetingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Suspense>
      <MeetingPageClient code={code} />
    </Suspense>
  );
}
