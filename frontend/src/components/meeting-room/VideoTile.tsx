"use client";

import { MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useElementSize } from "@/hooks/useElementSize";
import { useSpeaking } from "@/hooks/useSpeaking";
import { cn } from "@/lib/cn";

interface VideoTileProps {
  name: string;
  stream: MediaStream | null;
  audioOn: boolean;
  videoOn: boolean;
  isSelf?: boolean;
  isHost?: boolean;
  isScreen?: boolean;
  className?: string;
  compact?: boolean;
}

export function VideoTile({ name, stream, audioOn, videoOn, isSelf = false, isHost = false, isScreen = false, className, compact = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref: tileRef, width, height } = useElementSize<HTMLDivElement>();
  const [sourcePortrait, setSourcePortrait] = useState<boolean | null>(null);
  const speaking = useSpeaking(stream, audioOn);

  // Cameras always fill their tile (cropping edges, like Zoom), except a
  // portrait phone video shown in a landscape tile, which is pillarboxed so
  // the person isn't cut off. Shared screens are never cropped.
  const tilePortrait = height > width;
  const fitWhole = isScreen || (sourcePortrait === true && width > 0 && !tilePortrait);
  const onFrameSize = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth && videoHeight) setSourcePortrait(videoHeight > videoWidth);
  };

  useEffect(() => {
    const element = videoRef.current;
    if (element && element.srcObject !== stream) element.srcObject = stream;
  }, [stream]);

  const showVideo = Boolean(stream) && (videoOn || isScreen);
  const label = `${name}${isSelf ? " (You)" : ""}`;

  return (
    <div
      ref={tileRef}
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-xl bg-room-tile",
        "ring-2 transition-shadow",
        speaking ? "ring-zoom-green" : "ring-transparent",
        className,
      )}
    >
      {/* The <video> stays mounted even when hidden so remote audio keeps playing. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        onLoadedMetadata={onFrameSize}
        onResize={onFrameSize}
        className={cn(
          "absolute inset-0 size-full",
          fitWhole ? "object-contain" : "object-cover",
          isSelf && !isScreen && "mirror",
          !showVideo && "invisible",
        )}
      />
      {!showVideo && (
        <div className="flex flex-col items-center gap-3">
          <Avatar name={name} size={compact ? "lg" : "xl"} />
          {!compact && <span className="text-lg font-bold text-white">{name}</span>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {!audioOn && <MicOff aria-label="Muted" className="size-3.5 shrink-0 text-zoom-red" />}
        <span className="truncate">{isScreen ? `${label}'s screen` : label}</span>
        {isHost && !isScreen && <span className="shrink-0 text-white/70">· Host</span>}
      </div>
    </div>
  );
}
