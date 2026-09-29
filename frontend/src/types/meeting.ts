// Mirrors the backend DTOs (app/schemas). Keep in sync with the API contract.

export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type MeetingType = "instant" | "scheduled";
export type ParticipantRole = "host" | "attendee";
export type ParticipantStatus = "pending" | "connected" | "left" | "removed";

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface MeetingSettings {
  mute_on_entry: boolean;
  host_video_on: boolean;
  participant_video_on: boolean;
}

export interface Meeting extends MeetingSettings {
  meeting_code: string;
  formatted_code: string;
  passcode: string;
  invite_link: string;
  title: string;
  description: string | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  started_at: string | null;
  ended_at: string | null;
  host: User;
  participant_count: number;
}

export interface MeetingPreview extends MeetingSettings {
  meeting_code: string;
  formatted_code: string;
  title: string;
  host_name: string;
  status: MeetingStatus;
  start_time: string;
}

export interface Participant {
  id: number;
  display_name: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: string | null;
  left_at: string | null;
}

export interface JoinSession {
  participant: Participant;
  token: string;
  meeting: Meeting;
}

export interface ChatMessage {
  id: number;
  participant_id: number;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface ScheduleMeetingInput extends MeetingSettings {
  title: string;
  description?: string;
  start_time: string; // ISO-8601 with offset
  duration_minutes: number;
  timezone: string;
  passcode?: string;
}
