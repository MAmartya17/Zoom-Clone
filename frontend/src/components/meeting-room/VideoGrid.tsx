"use client";

import { useElementSize } from "@/hooks/useElementSize";
import { chooseRoomLayout } from "@/lib/galleryLayout";
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
  const sharer = participants.find((p) => p.screen);
  const layout = chooseRoomLayout(participants.length, width, height, Boolean(sharer));

  const tile = (
    p: RoomParticipant,
    options: { className?: string; compact?: boolean; isScreen?: boolean; style?: React.CSSProperties } = {},
  ) => (
    <div key={`${p.id}-${options.isScreen ? "screen" : "cam"}`} className={options.className} style={options.style}>
      <VideoTile
        name={p.display_name}
        stream={p.id === selfId ? selfStream : remoteStreams[p.id] ?? null}
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

  const render = () => {
    if (width === 0) return null; // wait for the first measurement

    switch (layout.kind) {
      case "share": {
        const others = participants.filter((p) => p.id !== sharer!.id);
        const landscape = width > height;
        return (
          <div className={landscape ? "flex size-full gap-2" : "flex size-full flex-col gap-2"}>
            {tile(sharer!, { isScreen: true, className: "min-h-0 min-w-0 flex-1" })}
            {others.length > 0 && (
              <div className={landscape ? "room-scrollbar flex w-32 shrink-0 flex-col gap-2 overflow-y-auto sm:w-56" : "room-scrollbar flex h-24 shrink-0 gap-2 overflow-x-auto"}>
                {others.map((p) => tile(p, { compact: true, className: landscape ? "aspect-video w-full shrink-0" : "aspect-[3/4] h-full shrink-0" }))}
              </div>
            )}
          </div>
        );
      }

      case "pip": {
        const self = participants.find((p) => p.id === selfId) ?? participants[1];
        const other = participants.find((p) => p !== self)!;
        return (
          <div className="relative size-full">
            {tile(other, { className: "size-full" })}
            {tile(self, {
              compact: true,
              className: "absolute bottom-3 right-3 z-10 aspect-[3/4] w-[28%] max-w-40 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20",
            })}
          </div>
        );
      }

      case "fill":
        return (
          <div
            className="grid size-full"
            style={{
              gap: GAP_PX,
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
            }}
          >
            {participants.map((p) => tile(p, { compact: layout.columns > 1, className: "min-h-0" }))}
          </div>
        );

      case "gallery":
        return (
          <div className="flex size-full flex-wrap content-center items-center justify-center" style={{ gap: GAP_PX }}>
            {participants.map((p) =>
              tile(p, { compact: layout.tileWidth < 360, style: { width: layout.tileWidth, height: layout.tileHeight } }),
            )}
          </div>
        );
    }
  };

  return (
    <div className="size-full p-2">
      <div ref={ref} className="size-full">
        {render()}
      </div>
    </div>
  );
}
