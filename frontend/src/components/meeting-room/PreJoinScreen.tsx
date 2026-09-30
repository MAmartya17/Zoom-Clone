"use client";

import { AlertTriangle, Mic, MicOff, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ZoomLogo } from "@/components/layout/ZoomLogo";
import { Button } from "@/components/ui/Button";
import { ApiError, errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { cn } from "@/lib/cn";
import { formatFullDateTime } from "@/lib/datetime";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/validation/joinForm";
import type { MediaDevices } from "@/hooks/useMediaDevices";
import type { JoinSession, MeetingPreview } from "@/types/meeting";
import { VideoTile } from "./VideoTile";

interface PreJoinScreenProps {
  preview: MeetingPreview;
  isHost: boolean;
  media: MediaDevices;
  initialName: string;
  initialPasscode: string;
  onJoined: (session: JoinSession) => void;
}

const inputClass =
  "h-11 w-full rounded-lg border bg-room px-3 text-sm text-white placeholder:text-white/40 focus:border-zoom-blue focus:outline-none";

/** Camera/mic preview + name (+ passcode) before entering, like Zoom's web client. */
export function PreJoinScreen({ preview, isHost, media, initialName, initialPasscode, onJoined }: PreJoinScreenProps) {
  const [name, setName] = useState(initialName);
  const [passcode, setPasscode] = useState(initialPasscode);
  const [errors, setErrors] = useState<{ name?: string | null; passcode?: string | null; form?: string | null }>({});
  const [joining, setJoining] = useState(false);
  const needsPasscode = !isHost && !initialPasscode;

  // The signed-in user's name may arrive after first render; prefill once.
  useEffect(() => {
    if (initialName) setName((current) => current || initialName);
  }, [initialName]);

  const join = async () => {
    const nameError = validateDisplayName(name);
    const passcodeError = !isHost && !passcode.trim() ? "Please enter the meeting passcode." : null;
    setErrors({ name: nameError, passcode: passcodeError });
    if (nameError || passcodeError) return;

    setJoining(true);
    try {
      const session = isHost
        ? await meetingsApi.start(preview.meeting_code, name.trim())
        : await meetingsApi.join(preview.meeting_code, name.trim(), passcode.trim());
      onJoined(session);
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PASSCODE") setErrors({ passcode: err.message });
      else if (err instanceof ApiError && err.details?.display_name) setErrors({ name: err.details.display_name });
      else setErrors({ form: errorMessage(err) });
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-room text-white">
      <header className="flex h-14 items-center px-6 short:h-10">
        <Link href="/" aria-label="Back to home">
          <ZoomLogo dark />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center items-center gap-6 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:gap-8 md:grid-cols-[1.4fr_1fr] short:grid-cols-2 short:gap-4 short:pb-4">
        <div className="flex flex-col gap-3">
          <VideoTile
            name={name.trim() || "You"}
            stream={media.cameraStream}
            audioOn={media.audioEnabled}
            videoOn={media.videoEnabled}
            isSelf
            // Upright phones get a portrait preview (their camera is portrait); wider screens get 16:9.
            className="mx-auto aspect-[3/4] h-[42dvh] max-w-full sm:aspect-video sm:h-auto sm:w-full short:h-[55dvh] short:w-auto"
          />
          <div className="flex justify-center gap-3">
            <PreviewToggle
              on={media.audioEnabled}
              disabled={!media.audioTrack}
              onClick={media.toggleAudio}
              onIcon={<Mic className="size-5" />}
              offIcon={<MicOff className="size-5" />}
              label={media.audioEnabled ? "Mute" : "Unmute"}
            />
            <PreviewToggle
              on={media.videoEnabled}
              disabled={!media.cameraTrack}
              onClick={media.toggleVideo}
              onIcon={<Video className="size-5" />}
              offIcon={<VideoOff className="size-5" />}
              label={media.videoEnabled ? "Stop Video" : "Start Video"}
            />
          </div>
          {media.error && (
            <p className="flex items-start gap-2 rounded-lg bg-zoom-orange/15 px-3 py-2 text-xs text-[#ffb38a]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {media.error}
            </p>
          )}
        </div>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            join();
          }}
        >
          <div>
            <h1 className="text-2xl font-black">{preview.title}</h1>
            <p className="mt-1 text-sm text-white/60">
              Hosted by {preview.host_name} · ID {preview.formatted_code}
            </p>
            {preview.status === "scheduled" && (
              <p className="text-sm text-white/60">Scheduled for {formatFullDateTime(preview.start_time)}</p>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Your Name
            <input
              value={name}
              maxLength={DISPLAY_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              aria-invalid={!!errors.name}
              className={cn(inputClass, errors.name ? "border-zoom-red" : "border-room-line")}
              autoFocus={!initialName}
            />
            {errors.name && <span className="text-xs font-normal text-[#ff8a8a]">{errors.name}</span>}
          </label>

          {needsPasscode && (
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              Meeting Passcode
              <input
                type="password"
                value={passcode}
                maxLength={10}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="Enter meeting passcode"
                aria-invalid={!!errors.passcode}
                className={cn(inputClass, errors.passcode ? "border-zoom-red" : "border-room-line")}
                autoFocus={Boolean(initialName)}
              />
            </label>
          )}
          {errors.passcode && <span className="-mt-2 text-xs text-[#ff8a8a]">{errors.passcode}</span>}
          {errors.form && <p className="rounded-lg bg-zoom-red/15 px-3 py-2 text-sm text-[#ff8a8a]">{errors.form}</p>}

          <Button type="submit" size="lg" loading={joining || !media.ready} className="w-full">
            {isHost ? "Start" : "Join"}
          </Button>
          <Link href="/" className="text-center text-sm text-white/60 hover:text-white">
            Cancel
          </Link>
        </form>
      </main>
    </div>
  );
}

function PreviewToggle({
  on,
  disabled,
  onClick,
  onIcon,
  offIcon,
  label,
}: {
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-12 items-center justify-center rounded-full transition-colors disabled:opacity-40",
        on ? "bg-room-hover hover:bg-room-line" : "bg-zoom-red hover:bg-zoom-red-hover",
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
