import { describe, expect, it } from "vitest";
import { bestGalleryLayout } from "./galleryLayout";

describe("bestGalleryLayout", () => {
  it("keeps a single tile 16:9 and bounded by height", () => {
    const layout = bestGalleryLayout(1, 1600, 700, 0);
    expect(layout.columns).toBe(1);
    expect(layout.tileHeight).toBe(700);
    expect(layout.tileWidth).toBe(Math.floor(700 * (16 / 9)));
  });

  it("places two people side by side on a wide screen", () => {
    expect(bestGalleryLayout(2, 1400, 760).columns).toBe(2);
  });

  it("stacks two people on a tall (mobile) screen", () => {
    expect(bestGalleryLayout(2, 390, 700).columns).toBe(1);
  });

  it("uses a 2x2 grid for four people on a landscape screen", () => {
    expect(bestGalleryLayout(4, 1400, 800).columns).toBe(2);
  });

  it("never overflows the container", () => {
    for (const count of [1, 3, 5, 7, 9]) {
      const { columns, tileWidth, tileHeight } = bestGalleryLayout(count, 1200, 700, 8);
      const rows = Math.ceil(count / columns);
      expect(columns * tileWidth + (columns - 1) * 8).toBeLessThanOrEqual(1200);
      expect(rows * tileHeight + (rows - 1) * 8).toBeLessThanOrEqual(700);
    }
  });

  it("returns an empty layout before the container is measured", () => {
    expect(bestGalleryLayout(3, 0, 0).tileWidth).toBe(0);
  });
});
