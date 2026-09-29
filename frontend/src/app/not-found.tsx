import Link from "next/link";
import { ZoomLogo } from "@/components/layout/ZoomLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
      <ZoomLogo />
      <h1 className="text-2xl font-black text-ink">Page not found</h1>
      <p className="text-ink-muted">The page you are looking for doesn&apos;t exist.</p>
      <Link href="/" className="rounded-lg bg-zoom-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-zoom-blue-hover">
        Back to Home
      </Link>
    </main>
  );
}
