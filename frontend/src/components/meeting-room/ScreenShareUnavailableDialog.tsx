"use client";

import { MonitorUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Shown when the browser has no screen-capture API (all iOS/Android browsers today).
 * No website can capture a phone screen; Zoom itself requires its native app for that.
 */
export function ScreenShareUnavailableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Share Screen" size="sm" footer={<Button onClick={onClose}>OK</Button>}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-zoom-green text-white">
          <MonitorUp className="size-7" />
        </span>
        <p className="font-bold text-ink">Screen sharing isn&apos;t available in this browser</p>
        <p className="text-sm text-ink-muted">
          Mobile browsers (Chrome on Android, Safari on iPhone and iPad) don&apos;t let websites capture the screen. To
          share, join this meeting from a computer using Chrome, Edge or Firefox. You can still see screens that others
          share.
        </p>
      </div>
    </Modal>
  );
}
