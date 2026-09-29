"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/datetime";
import type { ChatMessage } from "@/types/meeting";
import { SidePanel } from "./SidePanel";

const MAX_LENGTH = 1000;

interface ChatPanelProps {
  messages: ChatMessage[];
  selfId: number | null;
  onSend: (body: string) => void;
  onClose: () => void;
}

export function ChatPanel({ messages, selfId, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    onSend(body);
    setDraft("");
  };

  return (
    <SidePanel
      title="Meeting Chat"
      onClose={onClose}
      footer={
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs text-white/60">
            To: <span className="rounded bg-zoom-blue px-1.5 py-0.5 font-bold text-white">Everyone</span>
          </p>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              maxLength={MAX_LENGTH}
              rows={2}
              placeholder="Type message here..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              className="room-scrollbar min-h-10 flex-1 resize-none rounded-lg border border-room-line bg-room px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-zoom-blue focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="rounded-lg bg-zoom-blue p-2 text-white hover:bg-zoom-blue-hover disabled:opacity-40"
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </form>
      }
    >
      {messages.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-white/50">Messages addressed to &quot;Everyone&quot; will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-3 p-4">
          {messages.map((message) => {
            const mine = message.participant_id === selfId;
            return (
              <li key={message.id} className="text-sm">
                <p className="text-xs text-white/60">
                  <span className="font-bold text-white/80">{mine ? "Me" : message.sender_name}</span> · {formatTime(message.created_at)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{message.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={endRef} />
    </SidePanel>
  );
}
