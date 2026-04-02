import type { Transaction } from "@/lib/api/schemas"

/** In-memory stand-in until a real API exists; RTK Query mutations mutate this array in place. */
export const mockTransactions: Transaction[] = [
  {
    id: "1",
    title: "Salary",
    amount: 85_000,
    type: "income",
    date: "2026-04-01",
  },
  {
    id: "2",
    title: "Groceries",
    amount: 4_250,
    type: "expense",
    date: "2026-03-30",
  },
]

export function resetMockTransactions(seed: Transaction[]) {
  mockTransactions.length = 0
  mockTransactions.push(...seed)
}
