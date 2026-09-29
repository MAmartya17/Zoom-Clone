import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-zoom-blue-soft text-zoom-blue">{icon}</div>
      <p className="font-bold text-ink">{title}</p>
      {description && <p className="max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
