import { cn } from "@/lib/cn";

const PALETTE = ["#0b5cff", "#00a15d", "#ff742e", "#7b61ff", "#e02828", "#0091a8", "#c2410c", "#8a38f5"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** Stable colour per name so a participant keeps the same avatar everywhere. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", sizes[size], className)}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}
