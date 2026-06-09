import { parseInrScalar } from "@/lib/money/parse-inr"

/** en-IN, ₹, always 2 decimal places — matches backend monetary precision. */
export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseInrScalar(amount))
}

/** ₹ with explicit +/− for non-zero (Udhar net balance, etc.). */
export function formatSignedCurrencyInr(amount: number | string): string {
  const n = parseInrScalar(amount)
  if (n === 0) return formatCurrency(0)
  const sign = n > 0 ? "+" : "−"
  return `${sign}${formatCurrency(Math.abs(n))}`
}

/** e.g. "2 Apr 2026" */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

/** e.g. "12 Apr" — for compact money-flow rows (ISO `YYYY-MM-DD`). */
export function formatDayMonthShort(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  if (!Number.isFinite(d.getTime())) return isoDate
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(d)
}
