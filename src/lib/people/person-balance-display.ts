import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Matches People list: positive → you receive; negative → you pay. */
export function personNetListCaption(signed: number): string {
  if (signed > 0) return "You will get"
  if (signed < 0) return "You will give"
  return "Settled"
}

export function personNetTextClassName(signed: number): string {
  if (signed > 0) return "text-emerald-600 dark:text-emerald-400"
  if (signed < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

/** One-line balance label for People list cards (signed `person.totalBalance`). */
export function personNetBalanceLine(signed: number): string {
  const absFormatted = formatCurrency(Math.abs(signed))
  if (signed > 0) return `You will get ${absFormatted}`
  if (signed < 0) return `You will give ${absFormatted}`
  return "Settled"
}

export function personNetAmountClassName(signed: number): string {
  return cn("font-semibold tabular-nums leading-snug", personNetTextClassName(signed))
}
