import { describe, expect, it } from "vitest";
import { WsCloseCode, type RoomParticipant } from "@/types/realtime";
import { initialRoomState, orderedParticipants, roomReducer, type RoomState } from "./roomReducer";

const host: RoomParticipant = { id: 1, display_name: "Alex", role: "host", audio: true, video: true, screen: false };
const guest: RoomParticipant = { id: 2, display_name: "Priya", role: "attendee", audio: false, video: false, screen: false };

function connected(): RoomState {
  return roomReducer(initialRoomState, { type: "server", message: { type: "room_state", self_id: 2, participants: [host, guest] } });
}

describe("roomReducer", () => {
  it("enters the room from room_state", () => {
    const state = connected();
    expect(state.status).toBe("connected");
    expect(state.selfId).toBe(2);
    expect(orderedParticipants(state).map((p) => p.display_name)).toEqual(["Alex", "Priya"]);
  });

  it("tracks joins, media updates and departures", () => {
    const newcomer: RoomParticipant = { ...guest, id: 3, display_name: "Daniel" };
    let state = roomReducer(connected(), { type: "server", message: { type: "participant_joined", participant: newcomer } });
    state = roomReducer(state, { type: "server", message: { type: "participant_updated", participant: { ...newcomer, audio: true } } });
    expect(state.participants[3].audio).toBe(true);
    expect(state.order).toEqual([1, 2, 3]);

    state = roomReducer(state, { type: "server", message: { type: "participant_left", participant_id: 1 } });
    expect(state.order).toEqual([2, 3]);
    expect(state.participants[1]).toBeUndefined();
  });

  it("deduplicates chat messages from history and live events", () => {
    const message = { id: 7, participant_id: 1, sender_name: "Alex", body: "Hi", created_at: "2030-01-01T00:00:00Z" };
    let state = roomReducer(connected(), { type: "server", message: { type: "chat_message", message } });
    state = roomReducer(state, { type: "chat_history", messages: [message] });
    expect(state.messages).toHaveLength(1);
  });

  it("exits on removal and ignores later messages", () => {
    let state = roomReducer(connected(), { type: "server", message: { type: "removed", reason: "Removed by host" } });
    expect(state.status).toBe("removed");
    state = roomReducer(state, { type: "socket_closed", code: WsCloseCode.REMOVED });
    state = roomReducer(state, { type: "server", message: { type: "participant_joined", participant: host } });
    expect(state.status).toBe("removed");
    expect(state.exitReason).toBe("Removed by host");
  });

  it.each([
    [WsCloseCode.MEETING_ENDED, "ended"],
    [WsCloseCode.REMOVED, "removed"],
    [WsCloseCode.INVALID_SESSION, "disconnected"],
    [1006, "disconnected"],
  ])("maps close code %i to %s", (code, status) => {
    expect(roomReducer(connected(), { type: "socket_closed", code }).status).toBe(status);
  });

  it("marks a voluntary leave", () => {
    expect(roomReducer(connected(), { type: "left" }).status).toBe("left");
  });
});
