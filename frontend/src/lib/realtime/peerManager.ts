import type { SignalData } from "@/types/realtime";

type TrackKind = "audio" | "video";

export interface LocalTracks {
  audio: MediaStreamTrack | null;
  video: MediaStreamTrack | null;
}

export interface PeerManagerOptions {
  iceServers: RTCIceServer[];
  getLocalTracks: () => LocalTracks;
  sendSignal: (to: number, data: SignalData) => void;
  onRemoteStream: (peerId: number, stream: MediaStream) => void;
  onConnectionStateChange?: (peerId: number, state: RTCPeerConnectionState) => void;
}

interface Peer {
  pc: RTCPeerConnection;
  tracks: MediaStreamTrack[];
  pendingCandidates: RTCIceCandidateInit[];
  // Signals for one peer are processed strictly in order (offer before ICE, etc.).
  queue: Promise<void>;
}

/**
 * Full-mesh WebRTC: one RTCPeerConnection per remote participant.
 *
 * Negotiation rule: the participant who joins later always sends the offer,
 * so two peers never offer to each other at the same time ("glare").
 * Each connection always carries one audio and one video transceiver; camera
 * <-> screen-share switches use replaceTrack(), which needs no renegotiation.
 */
export class PeerManager {
  private readonly peers = new Map<number, Peer>();

  constructor(private readonly options: PeerManagerOptions) {}

  /** Called by the newcomer for every participant already in the room. */
  connectTo(peerId: number): void {
    const peer = this.getOrCreatePeer(peerId);
    this.enqueue(peer, async () => {
      const { audio, video } = this.options.getLocalTracks();
      peer.pc.addTransceiver(audio ?? "audio", { direction: "sendrecv" });
      peer.pc.addTransceiver(video ?? "video", { direction: "sendrecv" });
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.options.sendSignal(peerId, { sdp: peer.pc.localDescription!.toJSON() });
    });
  }

  handleSignal(from: number, data: SignalData): void {
    const peer = this.getOrCreatePeer(from);
    this.enqueue(peer, async () => {
      if ("sdp" in data) await this.handleDescription(from, peer, data.sdp);
      else if ("candidate" in data) await this.handleCandidate(peer, data.candidate);
    });
  }

  async replaceTrack(kind: TrackKind, track: MediaStreamTrack | null): Promise<void> {
    await Promise.all(
      [...this.peers.values()].map(async ({ pc }) => {
        const transceiver = pc.getTransceivers().find((t) => t.receiver.track.kind === kind);
        if (transceiver && transceiver.sender.track !== track) await transceiver.sender.replaceTrack(track);
      }),
    );
  }

  removePeer(peerId: number): void {
    this.peers.get(peerId)?.pc.close();
    this.peers.delete(peerId);
  }

  closeAll(): void {
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
  }

  // --- internals ---

  private async handleDescription(from: number, peer: Peer, sdp: RTCSessionDescriptionInit): Promise<void> {
    await peer.pc.setRemoteDescription(sdp);
    if (sdp.type === "offer") {
      await this.attachLocalTracks(peer.pc);
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      this.options.sendSignal(from, { sdp: peer.pc.localDescription!.toJSON() });
    }
    // Candidates that arrived before the remote description can be applied now.
    const pending = peer.pendingCandidates.splice(0);
    for (const candidate of pending) await peer.pc.addIceCandidate(candidate);
  }

  private async handleCandidate(peer: Peer, candidate: RTCIceCandidateInit): Promise<void> {
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
    else peer.pendingCandidates.push(candidate);
  }

  /** Answerer side: bind our tracks to the transceivers created by the offer. */
  private async attachLocalTracks(pc: RTCPeerConnection): Promise<void> {
    const local = this.options.getLocalTracks();
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind as TrackKind;
      transceiver.direction = "sendrecv";
      await transceiver.sender.replaceTrack(local[kind]);
    }
  }

  private getOrCreatePeer(peerId: number): Peer {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: this.options.iceServers });
    const peer: Peer = { pc, tracks: [], pendingCandidates: [], queue: Promise.resolve() };

    pc.onicecandidate = (event) => {
      if (event.candidate) this.options.sendSignal(peerId, { candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      peer.tracks = [...peer.tracks.filter((t) => t.kind !== event.track.kind), event.track];
      // A fresh MediaStream object makes React (and <video>) pick up the new track.
      this.options.onRemoteStream(peerId, new MediaStream(peer.tracks));
    };
    pc.onconnectionstatechange = () => this.options.onConnectionStateChange?.(peerId, pc.connectionState);

    this.peers.set(peerId, peer);
    return peer;
  }

  private enqueue(peer: Peer, task: () => Promise<void>): void {
    peer.queue = peer.queue.then(task).catch((err) => console.error("WebRTC negotiation failed", err));
  }
}
