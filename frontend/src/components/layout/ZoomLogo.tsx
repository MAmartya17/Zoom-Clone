import { cn } from "@/lib/cn";

/** Text wordmark in Zoom's brand style (no trademarked artwork is bundled). */
export function ZoomLogo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("flex items-baseline gap-1.5 select-none", className)}>
      <span className={cn("text-2xl font-black tracking-tight", dark ? "text-white" : "text-zoom-blue")}>zoom</span>
      <span className={cn("hidden text-sm font-bold sm:inline", dark ? "text-white/80" : "text-ink")}>Workplace</span>
    </span>
  );
}
