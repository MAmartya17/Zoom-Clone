"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraConstraints, supportsScreenShare } from "@/lib/device";

export interface MediaDevicesState {
  cameraStream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  /** What we send as "video": the screen while sharing, otherwise the camera. */
  outgoingVideoTrack: MediaStreamTrack | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  ready: boolean;
  error: string | null;
}

export type ScreenShareResult = "started" | "cancelled" | "unsupported" | "failed";

async function acquireMedia(): Promise<{ stream: MediaStream | null; error: string | null }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: "Your browser does not support camera or microphone access." };
  }
  // Portrait phones get a portrait frame instead of a cropped landscape one.
  const video = cameraConstraints();
  // Fall back gracefully so a missing camera does not also cost the microphone.
  const attempts: MediaStreamConstraints[] = [
    { audio: true, video },
    { audio: true, video: false },
    { audio: false, video },
  ];
  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const partial = !stream.getAudioTracks().length || !stream.getVideoTracks().length;
      return { stream, error: partial ? "Some devices are unavailable. Others can still see or hear you." : null };
    } catch (err) {
      lastError = err;
    }
  }
  const denied = lastError instanceof DOMException && lastError.name === "NotAllowedError";
  return {
    stream: null,
    error: denied
      ? "Camera and microphone access is blocked. Allow access in your browser settings to be seen and heard."
      : "No camera or microphone was found. You can still join and use chat.",
  };
}

/** Owns local camera, microphone and screen-share tracks for the meeting page. */
export function useMediaDevices(initial: { audio: boolean; video: boolean }) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenTrack, setScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(initial.audio);
  const [videoEnabled, setVideoEnabled] = useState(initial.video);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let cancelled = false;
    acquireMedia().then(({ stream, error: mediaError }) => {
      if (cancelled) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraStream(stream);
      setError(mediaError);
      setReady(true);
    });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      screenRef.current?.stop();
    };
  }, []);

  const audioTrack = cameraStream?.getAudioTracks()[0] ?? null;
  const cameraTrack = cameraStream?.getVideoTracks()[0] ?? null;

  // track.enabled = false sends silence / black frames without renegotiating.
  useEffect(() => {
    if (audioTrack) audioTrack.enabled = audioEnabled;
  }, [audioTrack, audioEnabled]);
  useEffect(() => {
    if (cameraTrack) cameraTrack.enabled = videoEnabled;
  }, [cameraTrack, videoEnabled]);

  const stopScreenShare = useCallback(() => {
    screenRef.current?.stop();
    screenRef.current = null;
    setScreenTrack(null);
  }, []);

  const startScreenShare = useCallback(async (): Promise<ScreenShareResult> => {
    if (!supportsScreenShare()) return "unsupported";
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = display.getVideoTracks()[0];
      // Fired when the user clicks the browser's own "Stop sharing" button.
      track.onended = stopScreenShare;
      screenRef.current = track;
      setScreenTrack(track);
      return "started";
    } catch (err) {
      // NotAllowedError = the user closed the picker; anything else is a real failure.
      return err instanceof DOMException && err.name === "NotAllowedError" ? "cancelled" : "failed";
    }
  }, [stopScreenShare]);

  const state: MediaDevicesState = {
    cameraStream,
    audioTrack,
    cameraTrack,
    screenTrack,
    outgoingVideoTrack: screenTrack ?? cameraTrack,
    audioEnabled: audioEnabled && Boolean(audioTrack),
    videoEnabled: videoEnabled && Boolean(cameraTrack),
    ready,
    error,
  };

  return {
    ...state,
    setAudioEnabled,
    toggleAudio: () => setAudioEnabled((value) => !value),
    toggleVideo: () => setVideoEnabled((value) => !value),
    startScreenShare,
    stopScreenShare,
  };
}

export type MediaDevices = ReturnType<typeof useMediaDevices>;
