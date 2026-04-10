import { formatDate } from "@/lib/format"
import type { Account } from "@/lib/api/account-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"

/** Subtitle line: `9 Apr 2026 · HSBC · note` (matches Entries screen design). */
export function buildRecentTxSubtitleLine(tx: RecentTransaction, accounts: Account[]): string {
  const dateStr = formatDate(tx.date)
  const fromSource = tx.sourceName?.trim()
  const fromId =
    tx.accountId != null
      ? accounts.find((a) => String(a.id) === String(tx.accountId))?.name?.trim()
      : undefined
  const accountPart = fromSource || fromId || ""
  const notePart = tx.subtitle?.trim() || ""
  return [dateStr, accountPart, notePart].filter(Boolean).join(" · ")
}
