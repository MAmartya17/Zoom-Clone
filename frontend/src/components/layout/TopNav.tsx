"use client";

import { Bell, Calendar, Home, LogOut, MessageSquare, PenLine, Search, Settings, User as UserIcon, Users, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { useCurrentUser } from "@/providers/CurrentUserProvider";
import { useToast } from "@/providers/ToastProvider";
import { ZoomLogo } from "./ZoomLogo";

interface NavItem {
  label: string;
  icon: ReactNode;
  href?: string; // items without href are placeholders for out-of-scope products
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: <Home className="size-5" />, href: "/" },
  { label: "Meetings", icon: <Video className="size-5" />, href: "/meetings" },
  { label: "Team Chat", icon: <MessageSquare className="size-5" /> },
  { label: "Scheduler", icon: <Calendar className="size-5" /> },
  { label: "Whiteboards", icon: <PenLine className="size-5" /> },
  { label: "Contacts", icon: <Users className="size-5" /> },
];

export function TopNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const toast = useToast();
  const comingSoon = (feature: string) => toast.info(`${feature} is not part of this demo.`);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Zoom Workplace home">
          <ZoomLogo />
        </Link>

        <label className="relative ml-2 hidden w-64 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            placeholder="Search"
            onKeyDown={(event) => event.key === "Enter" && comingSoon("Search")}
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm focus:border-zoom-blue focus:bg-white focus:outline-none"
          />
        </label>

        <nav className="mx-auto hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = item.href !== undefined && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
            const className = cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              active ? "text-zoom-blue" : "text-ink-muted hover:bg-surface hover:text-ink",
            );
            return item.href ? (
              <Link key={item.label} href={item.href} className={className} aria-current={active ? "page" : undefined}>
                {item.icon}
                {item.label}
              </Link>
            ) : (
              <button key={item.label} className={className} onClick={() => comingSoon(item.label)}>
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <IconAction label="Notifications" onClick={() => comingSoon("Notifications")}>
            <Bell className="size-5" />
          </IconAction>
          <IconAction label="Settings" onClick={() => comingSoon("Settings")}>
            <Settings className="size-5" />
          </IconAction>
          <Menu
            items={[
              { label: "Profile", icon: <UserIcon className="size-4" />, onSelect: () => comingSoon("Profile") },
              { label: "Settings", icon: <Settings className="size-4" />, onSelect: () => comingSoon("Settings") },
              { label: "Sign out", icon: <LogOut className="size-4" />, onSelect: () => comingSoon("Sign out") },
            ]}
            header={
              user && (
                <div className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-2">
                  <Avatar name={user.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user.name}</p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  </div>
                </div>
              )
            }
            trigger={({ toggle }) => (
              <button onClick={toggle} aria-label="Profile menu" className="ml-1 rounded-full ring-offset-2 hover:ring-2 hover:ring-line">
                <Avatar name={user?.name ?? "?"} size="sm" />
              </button>
            )}
          />
        </div>
      </div>

      {/* Mobile bottom-style nav for the two real destinations */}
      <nav className="flex border-t border-line md:hidden" aria-label="Primary mobile">
        {NAV_ITEMS.filter((item) => item.href).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!);
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn("flex flex-1 items-center justify-center gap-2 py-2 text-sm font-bold", active ? "text-zoom-blue" : "text-ink-muted")}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink">
      {children}
    </button>
  );
}
