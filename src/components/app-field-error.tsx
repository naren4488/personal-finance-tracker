/** Inline field error — matches FormMessage styling for non-RHF fields. */
export function AppFieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[11px] font-medium text-destructive sm:text-xs">{message}</p>
}
