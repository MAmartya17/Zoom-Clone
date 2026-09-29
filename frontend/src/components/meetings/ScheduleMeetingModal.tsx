"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { hasErrors, validateScheduleForm, type ScheduleFormErrors, type ScheduleFormValues } from "@/lib/validation/scheduleForm";
import { useCurrentUser } from "@/providers/CurrentUserProvider";
import type { Meeting } from "@/types/meeting";
import { ScheduleMeetingForm } from "./ScheduleMeetingForm";
import { defaultScheduleValues, mapServerErrors, meetingToScheduleValues, scheduleValuesToInput } from "./scheduleFormMapping";

interface ScheduleMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
  /** When provided the modal edits this meeting instead of creating one. */
  meeting?: Meeting | null;
}

export function ScheduleMeetingModal({ open, onClose, onSaved, meeting }: ScheduleMeetingModalProps) {
  const { user } = useCurrentUser();
  const [values, setValues] = useState<ScheduleFormValues>(() => defaultScheduleValues(user?.name));
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(meeting);

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setValues(meeting ? meetingToScheduleValues(meeting) : defaultScheduleValues(user?.name));
    setErrors({});
    setFormError(null);
  }, [open, meeting, user?.name]);

  const updateValues = (patch: Partial<ScheduleFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    // Clear errors for edited fields so feedback feels responsive.
    setErrors((current) => {
      const next = { ...current };
      if ("title" in patch) delete next.title;
      if ("description" in patch) delete next.description;
      if ("date" in patch || "time" in patch || "timezone" in patch) delete next.when;
      if ("durationHours" in patch || "durationMinutes" in patch) delete next.duration;
      if ("passcode" in patch || "passcodeEnabled" in patch) delete next.passcode;
      return next;
    });
  };

  const submit = async () => {
    const validation = validateScheduleForm(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    setFormError(null);
    try {
      const input = scheduleValuesToInput(values);
      const saved = meeting ? await meetingsApi.update(meeting.meeting_code, input) : await meetingsApi.schedule(input);
      onSaved(saved);
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? mapServerErrors(err.details) : {};
      if (hasErrors(fieldErrors)) setErrors(fieldErrors);
      else setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Meeting" : "Schedule Meeting"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="schedule-meeting-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      {formError && (
        <p role="alert" className="mb-4 rounded-lg bg-zoom-red/10 px-4 py-3 text-sm text-zoom-red">
          {formError}
        </p>
      )}
      <ScheduleMeetingForm values={values} errors={errors} onChange={updateValues} onSubmit={submit} />
    </Modal>
  );
}
