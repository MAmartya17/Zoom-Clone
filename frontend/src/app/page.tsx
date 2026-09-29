import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { HomeDashboard } from "@/components/dashboard/HomeDashboard";
import { TopNav } from "@/components/layout/TopNav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <Suspense>
        <RequireAuth>
          <HomeDashboard />
        </RequireAuth>
      </Suspense>
    </div>
  );
}
