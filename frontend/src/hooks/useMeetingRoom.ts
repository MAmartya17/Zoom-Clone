"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { meetingsApi } from "@/lib/api/meetings";
import { config } from "@/lib/config";
import { PeerManager } from "@/lib/realtime/peerManager";
import { initialRoomState, roomReducer } from "@/lib/realtime/roomReducer";
import { SignalingClient } from "@/lib/realtime/signalingClient";
import type { JoinSession } from "@/types/meeting";
import type { ServerMessage } from "@/types/realtime";
import type { MediaDevices } from "./useMediaDevices";

interface UseMeetingRoomOptions {
  session: JoinSession;
  media: MediaDevices;
  onForceMuted: (by: string) => void;
  onServerError: (message: string) => void;
}

/**
 * Bridges React and the realtime engine: owns the SignalingClient + PeerManager
 * for one session, feeds server events into the room reducer and exposes
 * meeting actions. WebRTC objects live in refs, never in React state.
 */
export function useMeetingRoom({ session, media, onForceMuted, onServerError }: UseMeetingRoomOptions) {
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const signalingRef = useRef<SignalingClient | null>(null);
  const peersRef = useRef<PeerManager | null>(null);

  // Latest values for callbacks created once per session.
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const callbacksRef = useRef({ onForceMuted, onServerError });
  callbacksRef.current = { onForceMuted, onServerError };

  const code = session.meeting.meeting_code;

  useEffect(() => {
    const dropStream = (peerId: number) =>
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[peerId];
        return next;
      });

    const peers = new PeerManager({
      iceServers: config.iceServers,
      getLocalTracks: () => ({ audio: mediaRef.current.audioTrack, video: mediaRef.current.outgoingVideoTrack }),
      sendSignal: (to, data) => signalingRef.current?.send({ type: "signal", to, data }),
      onRemoteStream: (peerId, stream) => setRemoteStreams((current) => ({ ...current, [peerId]: stream })),
    });

    const handleSideEffects = (message: ServerMessage) => {
      switch (message.type) {
        case "room_state":
          message.participants.filter((p) => p.id !== message.self_id).forEach((p) => peers.connectTo(p.id));
          break;
        case "participant_left":
          peers.removePeer(message.participant_id);
          dropStream(message.participant_id);
          break;
        case "signal":
          peers.handleSignal(message.from, message.data);
          break;
        case "force_mute":
          callbacksRef.current.onForceMuted(message.by);
          break;
        case "error":
          callbacksRef.current.onServerError(message.message);
          break;
        case "removed":
        case "meeting_ended":
          peers.closeAll();
          break;
      }
    };

    const signaling = new SignalingClient(`${config.wsUrl}/ws/meetings/${code}?token=${encodeURIComponent(session.token)}`, {
      onMessage: (message) => {
        handleSideEffects(message);
        dispatch({ type: "server", message });
      },
      onClose: (closeCode) => {
        peers.closeAll();
        dispatch({ type: "socket_closed", code: closeCode });
      },
    });

    peersRef.current = peers;
    signalingRef.current = signaling;
    signaling.connect();

    meetingsApi
      .messages(code)
      .then((messages) => dispatch({ type: "chat_history", messages }))
      .catch(() => undefined); // history is best-effort; live chat still works

    return () => {
      signaling.close();
      peers.closeAll();
      signalingRef.current = null;
      peersRef.current = null;
    };
  }, [code, session.token]);

  // Keep outgoing tracks in sync (camera <-> screen share, device changes).
  useEffect(() => {
    peersRef.current?.replaceTrack("video", media.outgoingVideoTrack);
  }, [media.outgoingVideoTrack]);
  useEffect(() => {
    peersRef.current?.replaceTrack("audio", media.audioTrack);
  }, [media.audioTrack]);

  // Tell everyone our mic / camera / share state whenever it changes.
  const sharing = Boolean(media.screenTrack);
  useEffect(() => {
    if (state.status !== "connected") return;
    signalingRef.current?.send({ type: "media_state", audio: media.audioEnabled, video: media.videoEnabled, screen: sharing });
  }, [state.status, media.audioEnabled, media.videoEnabled, sharing]);

  const send = useCallback((message: Parameters<SignalingClient["send"]>[0]) => signalingRef.current?.send(message), []);

  const actions = {
    sendChat: (body: string) => send({ type: "chat_message", body }),
    muteAll: () => send({ type: "mute_all" }),
    muteParticipant: (participantId: number) => send({ type: "mute_participant", participant_id: participantId }),
    removeParticipant: (participantId: number) => send({ type: "remove_participant", participant_id: participantId }),
    endMeeting: () => send({ type: "end_meeting" }),
    leave: () => {
      signalingRef.current?.close();
      peersRef.current?.closeAll();
      dispatch({ type: "left" });
    },
  };

  return { state, remoteStreams, actions };
}
