import { formatFullDateTime } from "@/lib/datetime";
import type { Meeting } from "@/types/meeting";

/** Plain-text invitation in the format Zoom's "Copy Invitation" produces. */
export function buildInvitationText(meeting: Meeting): string {
  const lines = [
    `${meeting.host.name} is inviting you to a ${meeting.meeting_type === "scheduled" ? "scheduled " : ""}Zoom meeting.`,
    "",
    `Topic: ${meeting.title}`,
  ];
  if (meeting.meeting_type === "scheduled") {
    lines.push(`Time: ${formatFullDateTime(meeting.start_time)} (${meeting.timezone})`);
  }
  lines.push(
    "",
    "Join Zoom Meeting",
    meeting.invite_link,
    "",
    `Meeting ID: ${meeting.formatted_code}`,
    `Passcode: ${meeting.passcode}`,
  );
  return lines.join("\n");
}
