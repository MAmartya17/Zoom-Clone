import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

interface ActionTileProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone: "orange" | "blue";
  loading?: boolean;
}

const tones = {
  orange: "bg-zoom-orange hover:bg-zoom-orange-hover",
  blue: "bg-zoom-blue hover:bg-zoom-blue-hover",
};

/** The large rounded-square buttons on Zoom's Home screen. */
export function ActionTile({ label, icon, onClick, tone, loading = false }: ActionTileProps) {
  return (
    <button onClick={onClick} disabled={loading} className="group flex flex-col items-center gap-3 focus-visible:outline-none short:gap-1.5">
      <span
        className={cn(
          "flex size-20 items-center justify-center rounded-3xl text-white shadow-md transition-all sm:size-24 short:size-14 short:rounded-2xl",
          "group-hover:shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-zoom-blue/30 group-active:scale-95",
          tones[tone],
        )}
      >
        {loading ? <Spinner className="size-8 border-[3px]" /> : icon}
      </span>
      <span className="text-sm font-bold text-ink">{label}</span>
    </button>
  );
}
