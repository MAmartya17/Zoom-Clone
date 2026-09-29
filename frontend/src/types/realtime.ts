import type { ChatMessage, ParticipantRole } from "./meeting";

// Mirrors backend/app/schemas/ws.py and the events sent by the connection handler.

export interface MediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

export interface RoomParticipant extends MediaState {
  id: number;
  display_name: string;
  role: ParticipantRole;
}

export type SignalData = { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit };

export type ServerMessage =
  | { type: "room_state"; self_id: number; participants: RoomParticipant[] }
  | { type: "participant_joined"; participant: RoomParticipant }
  | { type: "participant_updated"; participant: RoomParticipant }
  | { type: "participant_left"; participant_id: number }
  | { type: "signal"; from: number; data: SignalData }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "force_mute"; by: string }
  | { type: "removed"; reason: string }
  | { type: "meeting_ended"; reason: string }
  | { type: "error"; code: string; message: string };

export type ClientMessage =
  | { type: "signal"; to: number; data: SignalData }
  | ({ type: "media_state" } & MediaState)
  | { type: "chat_message"; body: string }
  | { type: "mute_all" }
  | { type: "mute_participant"; participant_id: number }
  | { type: "remove_participant"; participant_id: number }
  | { type: "end_meeting" };

/** Application close codes used by the backend (see WsCloseCode). */
export const WsCloseCode = {
  INVALID_SESSION: 4401,
  REMOVED: 4403,
  MEETING_NOT_FOUND: 4404,
  MEETING_ENDED: 4410,
} as const;
