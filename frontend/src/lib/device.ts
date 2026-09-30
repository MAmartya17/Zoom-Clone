/** Screen capture is feature-detected; iOS/Android browsers don't expose getDisplayMedia today. */
export function supportsScreenShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

export function isPortraitViewport(): boolean {
  return typeof window !== "undefined" && window.innerHeight > window.innerWidth;
}

const PORTRAIT_ASPECT = 3 / 4;
const LANDSCAPE_ASPECT = 16 / 9;

// Extension supported by Chromium: lets the browser crop the sensor image to
// the requested shape instead of returning the camera's native landscape frame.
type CroppableConstraints = MediaTrackConstraints & { resizeMode?: "crop-and-scale" | "none" };

/**
 * Phone cameras deliver landscape frames even when the phone is upright, so on
 * portrait screens we ask the browser to crop to 3:4. Everyone in the meeting
 * then sees a portrait picture, like Zoom's mobile app.
 */
export function cameraConstraints(): CroppableConstraints {
  return isPortraitViewport()
    ? { facingMode: "user", aspectRatio: { ideal: PORTRAIT_ASPECT }, height: { ideal: 960 }, resizeMode: "crop-and-scale" }
    : { facingMode: "user", aspectRatio: { ideal: LANDSCAPE_ASPECT }, width: { ideal: 1280 }, height: { ideal: 720 } };
}

/** Some browsers ignore aspectRatio in getUserMedia but honour it afterwards. */
export async function ensurePortraitFrame(track: MediaStreamTrack): Promise<void> {
  if (!isPortraitViewport()) return;
  const { width = 0, height = 0 } = track.getSettings();
  if (height >= width) return;
  try {
    await track.applyConstraints({ aspectRatio: { exact: PORTRAIT_ASPECT }, resizeMode: "crop-and-scale" } as CroppableConstraints);
  } catch {
    // Not supported: the tile crops the picture visually instead (object-fit: cover).
  }
}
