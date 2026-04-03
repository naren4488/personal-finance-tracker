export type AccountsSegmentId = "accounts" | "people" | "loans" | "cards"

export type AccountListItem = {
  id: string
  name: string
  entryCount: number
  /** Shown after "Pay by: " when set */
  payBy?: string
  /** Negative = owed (red), positive = to receive (green) */
  amountInr: number
}

export const ACCOUNTS_SEGMENT_META: Record<
  AccountsSegmentId,
  { label: string; listTitle: string }
> = {
  accounts: { label: "Accounts", listTitle: "Accounts" },
  people: { label: "People", listTitle: "People" },
  loans: { label: "Loans", listTitle: "Loans" },
  cards: { label: "Cards", listTitle: "Cards" },
}

export const ACCOUNTS_MOCK_BY_SEGMENT: Record<AccountsSegmentId, AccountListItem[]> = {
  accounts: [
    {
      id: "a1",
      name: "HDFC Savings",
      entryCount: 12,
      amountInr: 4_25_000,
    },
    {
      id: "a2",
      name: "Cash wallet",
      entryCount: 5,
      amountInr: 8_200,
    },
    {
      id: "a3",
      name: "UPI — Primary",
      entryCount: 28,
      amountInr: -1_500,
    },
  ],
  people: [
    {
      id: "p1",
      name: "Jitesh Papa",
      entryCount: 2,
      payBy: "9 Apr 2026",
      amountInr: -1_10_000,
    },
    {
      id: "p2",
      name: "Nikhil",
      entryCount: 2,
      payBy: "9 Apr 2026",
      amountInr: -45_000,
    },
    {
      id: "p3",
      name: "Binod",
      entryCount: 1,
      amountInr: 65_000,
    },
    {
      id: "p4",
      name: "Ananya Sharma",
      entryCount: 3,
      payBy: "15 Apr 2026",
      amountInr: 12_500,
    },
  ],
  loans: [
    {
      id: "l1",
      name: "Home loan — SBI",
      entryCount: 4,
      payBy: "5 Apr 2026",
      amountInr: -18_75_000,
    },
    {
      id: "l2",
      name: "Personal — Axis",
      entryCount: 1,
      amountInr: -2_40_000,
    },
  ],
  cards: [
    {
      id: "c1",
      name: "HDFC Regalia",
      entryCount: 6,
      amountInr: -32_400,
    },
    {
      id: "c2",
      name: "ICICI Amazon Pay",
      entryCount: 9,
      amountInr: 0,
    },
  ],
}

/** Names for Udhar “select existing person” dropdown (from People mock list). */
export const UDHAR_EXISTING_PERSONS: { id: string; name: string }[] =
  ACCOUNTS_MOCK_BY_SEGMENT.people.map(({ id, name }) => ({ id, name }))
