/** Only allow same-site relative redirects after login (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
