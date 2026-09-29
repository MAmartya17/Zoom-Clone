"use client";

import { useEffect, useState } from "react";

const SPEAKING_THRESHOLD = 0.04; // RMS level that counts as talking
const SAMPLE_INTERVAL_MS = 200;

/** True while the stream's audio is above a speaking threshold (drives the green tile border). */
export function useSpeaking(stream: MediaStream | null, enabled: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);
  const audioTrack = stream?.getAudioTracks()[0];

  useEffect(() => {
    if (!enabled || !audioTrack || typeof AudioContext === "undefined") {
      setSpeaking(false);
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(new MediaStream([audioTrack])).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      setSpeaking(rms > SPEAKING_THRESHOLD);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      context.close();
    };
  }, [audioTrack, enabled]);

  return speaking;
}
