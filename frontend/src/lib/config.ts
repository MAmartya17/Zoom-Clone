const DEFAULT_API_URL = "http://localhost:8000";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

function parseIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ICE_SERVERS;
  } catch {
    console.warn("NEXT_PUBLIC_ICE_SERVERS is not valid JSON; using default STUN servers.");
    return DEFAULT_ICE_SERVERS;
  }
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, "");

export const config = {
  apiUrl,
  apiBaseUrl: `${apiUrl}/api/v1`,
  // http(s) -> ws(s) so one variable configures both transports.
  wsUrl: (process.env.NEXT_PUBLIC_WS_URL || apiUrl.replace(/^http/, "ws")).replace(/\/$/, ""),
  iceServers: parseIceServers(process.env.NEXT_PUBLIC_ICE_SERVERS),
} as const;
