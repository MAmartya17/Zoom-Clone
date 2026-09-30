interface NavigatorWithUAData extends Navigator {
  userAgentData?: { mobile?: boolean };
}

/** Phones and tablets (including iPadOS, which reports itself as a Mac). */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithUAData;
  if (typeof nav.userAgentData?.mobile === "boolean" && nav.userAgentData.mobile) return true;
  const ua = nav.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
}

/**
 * Screen capture (getDisplayMedia) is not available in iOS or Android browsers;
 * even Zoom's own web client can't share from a phone. Viewing a share works everywhere.
 */
export function supportsScreenShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    !isMobileDevice()
  );
}

/** Ask for a camera frame that matches how the device is held. */
export function cameraConstraints(): MediaTrackConstraints {
  const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
  return portrait
    ? { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } }
    : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
}
