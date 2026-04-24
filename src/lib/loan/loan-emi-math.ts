/**
 * Reducing-balance loan EMI (monthly), annual rate in % p.a.
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1), r = annual/12/100.
 */
export function computeReducingBalanceMonthlyEmi(
  principalInr: number,
  annualRatePercent: number,
  tenureMonths: number
): number | null {
  const P = principalInr
  const n = Math.trunc(tenureMonths)
  if (!Number.isFinite(P) || P <= 0 || !Number.isFinite(n) || n < 1) return null
  const annual = Number(annualRatePercent)
  if (!Number.isFinite(annual) || annual < 0) return null
  const r = annual / 100 / 12
  if (r < 1e-12) {
    const flat = P / n
    return Number.isFinite(flat) && flat > 0 ? Math.round(flat * 100) / 100 : null
  }
  const pow = Math.pow(1 + r, n)
  if (!Number.isFinite(pow) || pow <= 1) return null
  const emi = (P * r * pow) / (pow - 1)
  if (!Number.isFinite(emi) || emi <= 0) return null
  return Math.round(emi * 100) / 100
}

/**
 * Implied annual % p.a. that produces `targetEmiInr` for given principal and tenure (bisection).
 */
export function solveAnnualRatePercentForMonthlyEmi(
  principalInr: number,
  tenureMonths: number,
  targetEmiInr: number
): number | null {
  const P = principalInr
  const n = Math.trunc(tenureMonths)
  const E = targetEmiInr
  if (
    !Number.isFinite(P) ||
    P <= 0 ||
    !Number.isFinite(n) ||
    n < 1 ||
    !Number.isFinite(E) ||
    E <= 0
  )
    return null

  const flat = P / n
  if (E + 1e-6 < flat) return null

  const emiAt = (annualPct: number) => computeReducingBalanceMonthlyEmi(P, annualPct, n)

  let high = 0.5
  let maxE = emiAt(high)
  let guard = 0
  while (maxE != null && maxE < E && high < 200 && guard < 24) {
    high *= 2
    maxE = emiAt(high)
    guard += 1
  }
  if (maxE == null || E > maxE + 0.02) return null

  let low = 0
  for (let i = 0; i < 90; i++) {
    const mid = (low + high) / 2
    const emiMid = emiAt(mid)
    if (emiMid == null) return null
    if (Math.abs(emiMid - E) < 0.01) return Math.round(mid * 1e6) / 1e6
    if (emiMid < E) low = mid
    else high = mid
  }
  return Math.round(((low + high) / 2) * 1e6) / 1e6
}

export function formatInterestRateForForm(rate: number): string {
  if (!Number.isFinite(rate)) return "0"
  const s = rate.toFixed(4).replace(/\.?0+$/, "")
  return s === "" ? "0" : s
}
