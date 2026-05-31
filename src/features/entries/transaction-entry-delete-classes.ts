import { cn } from "@/lib/utils"

/** Matches People (Udhar) list delete chip — pill, light red; hover darkens (light) / lightens (dark). */
export const transactionEntryDeleteChipClass = cn(
  "inline-flex items-center justify-center rounded-full border border-destructive/25 px-3 py-1 text-xs font-semibold shadow-sm transition-colors",
  "bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/20",
  "dark:border-destructive/40 dark:bg-destructive/20 dark:text-destructive-foreground dark:hover:bg-destructive/30 dark:active:bg-destructive/35",
  "disabled:pointer-events-none disabled:opacity-50"
)
