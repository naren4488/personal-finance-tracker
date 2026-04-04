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
