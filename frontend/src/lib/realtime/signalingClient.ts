import type { ClientMessage, ServerMessage } from "@/types/realtime";

export interface SignalingHandlers {
  onMessage: (message: ServerMessage) => void;
  onClose: (code: number) => void;
}

/** Thin typed wrapper around the meeting WebSocket (JSON in, JSON out). */
export class SignalingClient {
  private socket: WebSocket | null = null;
  private closedByUs = false;

  constructor(
    private readonly url: string,
    private readonly handlers: SignalingHandlers,
  ) {}

  connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onmessage = (event) => {
      try {
        this.handlers.onMessage(JSON.parse(event.data) as ServerMessage);
      } catch {
        console.warn("Ignoring malformed signaling message");
      }
    };
    socket.onclose = (event) => {
      if (!this.closedByUs) this.handlers.onClose(event.code);
    };
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /** Intentional leave: the server marks the participant as left. */
  close(): void {
    this.closedByUs = true;
    this.socket?.close(1000, "left");
    this.socket = null;
  }
}
