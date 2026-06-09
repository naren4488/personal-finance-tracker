/**
 * Analytics chart colors — CSS variable references (light/dark via global theme).
 * Use for Recharts `fill`/`stroke` and inline `backgroundColor` styles.
 */

/** Semantic series colors for monthly trends and grouped bars. */
export const ANALYTICS_CHART_COLORS = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  transfer: "var(--chart-transfer)",
  loanPayment: "var(--chart-loan-payment)",
  ccBillPayment: "var(--chart-cc-bill)",
  ccSpend: "var(--chart-cc-spend)",
  daySpend: "var(--chart-day-spend)",
} as const

/** Rotating palette for pie slices, payment-method bars, and type-count dots. */
export const ANALYTICS_CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const

export function analyticsChartPaletteColor(index: number): string {
  return ANALYTICS_CHART_PALETTE[index % ANALYTICS_CHART_PALETTE.length]
}
