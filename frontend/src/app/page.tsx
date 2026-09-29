import { HomeDashboard } from "@/components/dashboard/HomeDashboard";
import { TopNav } from "@/components/layout/TopNav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <HomeDashboard />
    </div>
  );
}
