"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  placement?: "bottom" | "top";
  dark?: boolean;
  header?: ReactNode;
}

/** Small dropdown menu that closes on outside click / Escape. */
export function Menu({ trigger, items, align = "right", placement = "bottom", dark = false, header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-40 min-w-52 overflow-hidden rounded-xl py-1.5 shadow-xl",
            dark ? "border border-room-line bg-room-panel text-white" : "border border-line bg-white text-ink",
            align === "right" ? "right-0" : "left-0",
            placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {header}
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors disabled:opacity-40",
                dark ? "hover:bg-room-hover" : "hover:bg-surface",
                item.danger && "text-zoom-red",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
