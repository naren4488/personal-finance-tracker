/** en-IN, ₹, no decimals — Indian numbering */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** ₹ with explicit +/− for non-zero (Udhar net balance, etc.). */
export function formatSignedCurrencyInr(amount: number): string {
  if (amount === 0) return formatCurrency(0)
  const sign = amount > 0 ? "+" : "−"
  return `${sign}${formatCurrency(Math.abs(amount))}`
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
