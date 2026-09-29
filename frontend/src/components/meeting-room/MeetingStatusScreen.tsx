import Link from "next/link";
import type { ReactNode } from "react";
import { ZoomLogo } from "@/components/layout/ZoomLogo";

interface MeetingStatusScreenProps {
  title: string;
  message?: string | null;
  actions?: ReactNode;
}

/** Full-screen message for invalid / ended meetings and after leaving. */
export function MeetingStatusScreen({ title, message, actions }: MeetingStatusScreenProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-4 text-center">
      <ZoomLogo />
      <h1 className="text-2xl font-black text-ink">{title}</h1>
      {message && <p className="max-w-md text-ink-muted">{message}</p>}
      <div className="flex gap-3">
        {actions}
        <Link href="/" className="rounded-lg bg-zoom-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-zoom-blue-hover">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
