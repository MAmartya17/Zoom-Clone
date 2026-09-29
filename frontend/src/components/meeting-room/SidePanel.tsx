import { X } from "lucide-react";
import type { ReactNode } from "react";

interface SidePanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Right-hand panel shell (full-screen overlay on small screens). */
export function SidePanel({ title, onClose, children, footer }: SidePanelProps) {
  return (
    <aside className="absolute inset-0 z-20 flex flex-col bg-room-panel text-white md:static md:w-80 md:shrink-0 md:border-l md:border-room-line">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-room-line px-4">
        <h2 className="text-sm font-bold">{title}</h2>
        <button onClick={onClose} aria-label={`Close ${title}`} className="rounded p-1 text-white/70 hover:bg-room-hover hover:text-white">
          <X className="size-4" />
        </button>
      </header>
      <div className="room-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <footer className="shrink-0 border-t border-room-line p-3">{footer}</footer>}
    </aside>
  );
}
