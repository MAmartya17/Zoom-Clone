"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every `intervalMs`. Null until mounted (avoids SSR mismatch). */
export function useClock(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
