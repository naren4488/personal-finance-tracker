import { cn } from "@/lib/utils"

/** Matches People (Udhar) list delete chip — pill, light red; hover darkens (light) / lightens (dark). */
export const transactionEntryDeleteChipClass = cn(
  "inline-flex items-center justify-center rounded-full border border-red-200/70 px-3 py-1 text-xs font-semibold shadow-sm transition-colors",
  "bg-[#FCE8E6] text-[#C5221F] hover:bg-[#EFC9C5] active:bg-[#E5B4AD]",
  "dark:border-rose-800/45 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/50 dark:active:bg-rose-900/65",
  "disabled:pointer-events-none disabled:opacity-50"
)
