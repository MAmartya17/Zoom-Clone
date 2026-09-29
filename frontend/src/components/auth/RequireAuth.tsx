"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser } from "@/providers/AuthProvider";

/** Current path + query, used as the post-login redirect target. */
export function useReturnPath(): string {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Renders children only for signed-in users; everyone else goes to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const returnPath = useReturnPath();

  useEffect(() => {
    if (!loading && !user) router.replace(loginHref(returnPath));
  }, [loading, user, router, returnPath]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-4 border-zoom-blue/20 border-t-zoom-blue" />
      </div>
    );
  }
  return <>{children}</>;
}
