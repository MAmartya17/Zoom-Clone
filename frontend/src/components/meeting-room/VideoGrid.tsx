"use client";

import { useElementSize } from "@/hooks/useElementSize";
import { bestGalleryLayout } from "@/lib/galleryLayout";
import type { RoomParticipant } from "@/types/realtime";
import { VideoTile } from "./VideoTile";

interface VideoGridProps {
  participants: RoomParticipant[];
  selfId: number | null;
  selfStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;
}

const GAP_PX = 8;

export function VideoGrid({ participants, selfId, selfStream, remoteStreams }: VideoGridProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const streamFor = (p: RoomParticipant) => (p.id === selfId ? selfStream : remoteStreams[p.id] ?? null);
  const sharer = participants.find((p) => p.screen);

  const tile = (
    p: RoomParticipant,
    options: { className?: string; compact?: boolean; isScreen?: boolean; style?: React.CSSProperties } = {},
  ) => (
    <div key={`${p.id}-${options.isScreen ? "screen" : "cam"}`} className={options.className} style={options.style}>
      <VideoTile
        name={p.display_name}
        stream={streamFor(p)}
        audioOn={p.audio}
        videoOn={p.video}
        isSelf={p.id === selfId}
        isHost={p.role === "host"}
        isScreen={options.isScreen}
        compact={options.compact}
        className="size-full"
      />
    </div>
  );

  // Screen-share layout: shared screen large, everyone else in a side strip.
  if (sharer) {
    const others = participants.filter((p) => p.id !== sharer.id);
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2 md:flex-row">
        {tile(sharer, { isScreen: true, className: "min-h-0 flex-1" })}
        {others.length > 0 && (
          <div className="room-scrollbar flex shrink-0 gap-2 overflow-auto md:w-56 md:flex-col">
            {others.map((p) => tile(p, { compact: true, className: "aspect-video w-40 shrink-0 md:w-full" }))}
          </div>
        )}
      </div>
    );
  }

  const layout = bestGalleryLayout(participants.length, width, height, GAP_PX);

  return (
    <div className="size-full p-2">
      <div ref={ref} className="flex size-full flex-wrap content-center items-center justify-center" style={{ gap: GAP_PX }}>
        {layout.tileWidth > 0 &&
          participants.map((p) =>
            tile(p, {
              compact: layout.tileWidth < 360,
              style: { width: layout.tileWidth, height: layout.tileHeight },
            }),
          )}
      </div>
    </div>
  );
}
