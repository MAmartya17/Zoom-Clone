import { TopNav } from "@/components/layout/TopNav";
import { JoinMeetingForm } from "@/components/join/JoinMeetingForm";

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-surface">
      <TopNav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <h1 className="mb-6 text-center text-2xl font-black text-ink">Join Meeting</h1>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <JoinMeetingForm />
        </div>
      </main>
    </div>
  );
}
