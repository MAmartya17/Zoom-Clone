"use client";

import { useClock } from "@/hooks/useClock";
import { formatLongDate, formatTime } from "@/lib/datetime";

/** Time and date header of the Home screen's right-hand card. */
export function ClockBanner() {
  const now = useClock(1000);

  return (
    <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-[#0b5cff] via-[#3d7bff] to-[#8fb3ff] px-6 py-8 text-white">
      {/* Decorative shapes echoing Zoom's illustrated banner */}
      <div aria-hidden className="absolute -right-10 -top-12 size-44 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-16 right-20 size-36 rounded-full bg-white/10" />
      <p className="relative text-4xl font-black tracking-tight sm:text-5xl" suppressHydrationWarning>
        {now ? formatTime(now) : " "}
      </p>
      <p className="relative mt-1 text-sm font-bold text-white/90">{now ? formatLongDate(now) : " "}</p>
    </div>
  );
}
