"use client";

import { Copy, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { formatDuration, formatFullDateTime } from "@/lib/datetime";
import { buildInvitationText } from "@/lib/invitation";
import type { Meeting } from "@/types/meeting";

interface InviteDialogProps {
  meeting: Meeting | null;
  onClose: () => void;
  title?: string;
}

/** Meeting details + copy actions, shown after scheduling or from a meeting's menu. */
export function InviteDialog({ meeting, onClose, title = "Meeting details" }: InviteDialogProps) {
  const copy = useCopyToClipboard();
  const router = useRouter();

  if (!meeting) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => copy(buildInvitationText(meeting), "Invitation copied")}>
            <Copy className="size-4" /> Copy Invitation
          </Button>
          <Button onClick={() => router.push(`/meeting/${meeting.meeting_code}?host=1`)}>Start</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-lg font-bold text-ink">{meeting.title}</p>
          {meeting.meeting_type === "scheduled" && (
            <p className="text-ink-muted">
              {formatFullDateTime(meeting.start_time)} · {formatDuration(meeting.duration_minutes)}
            </p>
          )}
          {meeting.description && <p className="mt-2 whitespace-pre-line text-ink">{meeting.description}</p>}
        </div>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 rounded-xl bg-surface p-4">
          <dt className="text-ink-muted">Meeting ID</dt>
          <dd className="font-bold">{meeting.formatted_code}</dd>
          <dt className="text-ink-muted">Passcode</dt>
          <dd className="font-bold">{meeting.passcode}</dd>
          <dt className="text-ink-muted">Invite link</dt>
          <dd className="flex min-w-0 items-center gap-2">
            <span className="truncate text-zoom-blue">{meeting.invite_link}</span>
            <button
              onClick={() => copy(meeting.invite_link, "Invite link copied")}
              className="shrink-0 rounded p-1 text-ink-muted hover:bg-white hover:text-zoom-blue"
              aria-label="Copy invite link"
            >
              <Link2 className="size-4" />
            </button>
          </dd>
        </dl>
      </div>
    </Modal>
  );
}
