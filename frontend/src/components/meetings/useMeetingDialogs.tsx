"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { buildInvitationText } from "@/lib/invitation";
import { useToast } from "@/providers/ToastProvider";
import type { Meeting } from "@/types/meeting";
import { InviteDialog } from "./InviteDialog";
import { ScheduleMeetingModal } from "./ScheduleMeetingModal";

export interface MeetingActions {
  schedule: () => void;
  viewDetails: (meeting: Meeting) => void;
  edit: (meeting: Meeting) => void;
  remove: (meeting: Meeting) => void;
  copyInvitation: (meeting: Meeting) => void;
}

/**
 * Shared dialog state for meeting actions (schedule, edit, details, delete),
 * used by both the Home dashboard and the Meetings page.
 */
export function useMeetingDialogs(onChanged: () => void) {
  const toast = useToast();
  const copy = useCopyToClipboard();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [details, setDetails] = useState<{ meeting: Meeting; title: string } | null>(null);
  const [deleting, setDeleting] = useState<Meeting | null>(null);

  const actions: MeetingActions = {
    schedule: () => setScheduleOpen(true),
    viewDetails: (meeting) => setDetails({ meeting, title: "Meeting details" }),
    edit: (meeting) => setEditing(meeting),
    remove: (meeting) => setDeleting(meeting),
    copyInvitation: (meeting) => copy(buildInvitationText(meeting), "Invitation copied"),
  };

  const closeEditor = () => {
    setScheduleOpen(false);
    setEditing(null);
  };

  const onSaved = (meeting: Meeting) => {
    const wasEdit = Boolean(editing);
    closeEditor();
    onChanged();
    toast.success(wasEdit ? "Meeting updated" : "Meeting scheduled");
    setDetails({ meeting, title: wasEdit ? "Meeting updated" : "Meeting scheduled" });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await meetingsApi.cancel(deleting.meeting_code);
      toast.success("Meeting deleted");
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const dialogs = (
    <>
      <ScheduleMeetingModal open={scheduleOpen || Boolean(editing)} meeting={editing} onClose={closeEditor} onSaved={onSaved} />
      <InviteDialog meeting={details?.meeting ?? null} title={details?.title} onClose={() => setDetails(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete meeting?"
        message={`"${deleting?.title ?? ""}" will be removed and participants will no longer be able to join.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );

  return { actions, dialogs };
}
