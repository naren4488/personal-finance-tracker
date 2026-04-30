export type DueCycle = "fixed" | "rolling"

export type LoanEmiFormModel = {
  bankLender: string
  loanAccountNo: string
  principal: string
  interestRate: string
  tenureMonths: string
  startDate: string
  emiDueDay: string
  dueCycle: DueCycle
  overrideEmi: boolean
  overrideEmiAmount: string
  overdue: boolean
  overdueAmount: string
}

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Calendar day 1–31 from `YYYY-MM-DD`; null if invalid. */
export function calendarDayFromIsoDate(iso: string): number | null {
  const s = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  if (!Number.isFinite(day) || day < 1 || day > 31) return null
  const dt = new Date(y, m - 1, day)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) return null
  return day
}

/** Value sent as `emiDueDay`: user-selected day for fixed mode; start-date day as placeholder for rolling (API may require it). */
export function resolveEmiDueDayForLoanSubmit(model: LoanEmiFormModel): number | null {
  if (model.dueCycle === "rolling") {
    return calendarDayFromIsoDate(model.startDate)
  }
  const emiDay = Number(String(model.emiDueDay).replace(/\D/g, "")) || 0
  if (emiDay < 1 || emiDay > 31) return null
  return emiDay
}

export function createInitialLoanEmiModel(): LoanEmiFormModel {
  return {
    bankLender: "",
    loanAccountNo: "",
    principal: "",
    interestRate: "8.5",
    tenureMonths: "60",
    startDate: todayIsoDate(),
    emiDueDay: "5",
    dueCycle: "fixed",
    overrideEmi: false,
    overrideEmiAmount: "",
    overdue: false,
    overdueAmount: "",
  }
}
