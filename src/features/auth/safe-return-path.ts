/** Internal path safe to use after login (no open redirects). */
export function safeReturnPath(from: unknown): string | null {
  if (typeof from !== "string" || from.length === 0) return null
  if (!from.startsWith("/")) return null
  if (from.startsWith("//") || from.includes("://")) return null
  if (from === "/login" || from === "/register") return null
  /** Profile is only reachable via explicit navigation — never a post-login redirect target. */
  if (from === "/profile") return null
  return from
}
