export type RoomLayout =
  | { kind: "share" } // someone is sharing: screen large + strip of cameras
  | { kind: "pip" } // portrait phone, 1:1 call: other person full screen, self floating (Zoom mobile)
  | { kind: "fill"; columns: number; rows: number } // portrait: tiles fill the screen, video cropped to fit
  | ({ kind: "gallery" } & GalleryLayout); // landscape: largest 16:9 tiles that fit

/** Picks the meeting layout for the available area, mirroring Zoom desktop vs. mobile behaviour. */
export function chooseRoomLayout(count: number, width: number, height: number, someoneSharing: boolean): RoomLayout {
  if (someoneSharing) return { kind: "share" };
  if (height > width) {
    if (count === 2) return { kind: "pip" };
    const columns = count <= 2 ? 1 : count <= 6 ? 2 : 3;
    return { kind: "fill", columns, rows: Math.ceil(count / columns) };
  }
  return { kind: "gallery", ...bestGalleryLayout(count, width, height) };
}

export interface GalleryLayout {
  columns: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Zoom-style gallery fit: choose the column count that makes 16:9 tiles as
 * large as possible inside the available area, instead of stretching tiles.
 */
export function bestGalleryLayout(
  count: number,
  width: number,
  height: number,
  gap = 8,
  aspectRatio = 16 / 9,
): GalleryLayout {
  let best: GalleryLayout = { columns: 1, tileWidth: 0, tileHeight: 0 };
  if (count <= 0 || width <= 0 || height <= 0) return best;

  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const maxWidth = (width - gap * (columns - 1)) / columns;
    const maxHeight = (height - gap * (rows - 1)) / rows;
    const tileWidth = Math.min(maxWidth, maxHeight * aspectRatio);
    if (tileWidth > best.tileWidth) {
      best = { columns, tileWidth: Math.floor(tileWidth), tileHeight: Math.floor(tileWidth / aspectRatio) };
    }
  }
  return best;
}
