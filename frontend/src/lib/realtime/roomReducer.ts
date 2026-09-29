import type { ChatMessage } from "@/types/meeting";
import { WsCloseCode, type RoomParticipant, type ServerMessage } from "@/types/realtime";

export type RoomStatus = "connecting" | "connected" | "left" | "ended" | "removed" | "disconnected";

export interface RoomState {
  status: RoomStatus;
  selfId: number | null;
  participants: Record<number, RoomParticipant>;
  order: number[]; // join order, used for stable tile placement
  messages: ChatMessage[];
  exitReason: string | null;
}

export type RoomAction =
  | { type: "server"; message: ServerMessage }
  | { type: "socket_closed"; code: number }
  | { type: "chat_history"; messages: ChatMessage[] }
  | { type: "left" };

export const initialRoomState: RoomState = {
  status: "connecting",
  selfId: null,
  participants: {},
  order: [],
  messages: [],
  exitReason: null,
};

const EXIT_REASONS = {
  ended: "This meeting has been ended by the host.",
  removed: "You have been removed from this meeting by the host.",
  disconnected: "You were disconnected from the meeting.",
  invalid: "Your meeting session has expired. Please join again.",
};

function isActive(state: RoomState): boolean {
  return state.status === "connecting" || state.status === "connected";
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function applyServerMessage(state: RoomState, message: ServerMessage): RoomState {
  switch (message.type) {
    case "room_state":
      return {
        ...state,
        status: "connected",
        selfId: message.self_id,
        participants: Object.fromEntries(message.participants.map((p) => [p.id, p])),
        order: message.participants.map((p) => p.id),
      };
    case "participant_joined":
    case "participant_updated": {
      const { participant } = message;
      const order = state.order.includes(participant.id) ? state.order : [...state.order, participant.id];
      return { ...state, participants: { ...state.participants, [participant.id]: participant }, order };
    }
    case "participant_left": {
      const participants = { ...state.participants };
      delete participants[message.participant_id];
      return { ...state, participants, order: state.order.filter((id) => id !== message.participant_id) };
    }
    case "chat_message":
      return { ...state, messages: mergeMessages(state.messages, [message.message]) };
    case "removed":
      return { ...state, status: "removed", exitReason: message.reason || EXIT_REASONS.removed };
    case "meeting_ended":
      return { ...state, status: "ended", exitReason: message.reason || EXIT_REASONS.ended };
    default:
      // signal / force_mute / error are side effects handled by useMeetingRoom.
      return state;
  }
}

function statusFromCloseCode(code: number): Pick<RoomState, "status" | "exitReason"> {
  switch (code) {
    case WsCloseCode.REMOVED:
      return { status: "removed", exitReason: EXIT_REASONS.removed };
    case WsCloseCode.MEETING_ENDED:
      return { status: "ended", exitReason: EXIT_REASONS.ended };
    case WsCloseCode.INVALID_SESSION:
      return { status: "disconnected", exitReason: EXIT_REASONS.invalid };
    default:
      return { status: "disconnected", exitReason: EXIT_REASONS.disconnected };
  }
}

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "server":
      // Once we've exited, late messages must not resurrect the room.
      return isActive(state) ? applyServerMessage(state, action.message) : state;
    case "socket_closed":
      return isActive(state) ? { ...state, ...statusFromCloseCode(action.code) } : state;
    case "chat_history":
      return { ...state, messages: mergeMessages(state.messages, action.messages) };
    case "left":
      return { ...state, status: "left", exitReason: null };
  }
}

export function orderedParticipants(state: RoomState): RoomParticipant[] {
  return state.order.map((id) => state.participants[id]).filter(Boolean);
}
