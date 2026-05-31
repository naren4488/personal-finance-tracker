/** Full-screen splash while session validation / token refresh runs on app boot. */
export function AuthSessionSplash() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4"
      aria-busy="true"
      aria-label="Restoring session"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading your session…</p>
    </div>
  )
}
