/** "5th of every month" style labels for days 1–28. */
export function dayOfMonthOrdinalLabel(day: number): string {
  const n = day % 100
  const suffix =
    n >= 11 && n <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th"
  return `${day}${suffix} of every month`
}

export const BILLING_DAY_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 28 },
  (_, i) => {
    const d = i + 1
    return { value: String(d), label: dayOfMonthOrdinalLabel(d) }
  }
)
