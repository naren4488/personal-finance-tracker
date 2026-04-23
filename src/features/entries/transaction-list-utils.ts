import { formatDate } from "@/lib/format"
import type { Account } from "@/lib/api/account-schemas"
import {
  inferUdharPersonName,
  isUdharRecentTransaction,
  udharDirectionLabel,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"

function inferUdharActionLabel(tx: RecentTransaction): "given" | "taken" | "received" | "made" {
  const rec = tx as unknown as Record<string, unknown>
  const raw = [
    typeof rec.kind === "string" ? rec.kind : "",
    typeof rec.title === "string" ? rec.title : "",
    typeof rec.subtitle === "string" ? rec.subtitle : "",
    typeof rec.note === "string" ? rec.note : "",
  ]
    .join(" ")
    .toLowerCase()
  if (raw.includes("payment_received") || raw.includes("payment received")) return "received"
  if (raw.includes("payment_made") || raw.includes("payment made")) return "made"
  return udharDirectionLabel(tx)
}

function buildUdharPersonPhrase(tx: RecentTransaction): string {
  const person = inferUdharPersonName(tx)
  const action = inferUdharActionLabel(tx)
  const safePerson = person === "Unknown" ? "Unknown person" : person
  if (action === "given") return `Given to ${safePerson}`
  if (action === "taken") return `Taken from ${safePerson}`
  if (action === "received") return `Received from ${safePerson}`
  return `Made to ${safePerson}`
}

/** Subtitle line: `9 Apr 2026 · HSBC · note` (matches Entries screen design). */
export function buildRecentTxSubtitleLine(tx: RecentTransaction, accounts: Account[]): string {
  const dateStr = formatDate(tx.date)
  if (isUdharRecentTransaction(tx)) {
    return [dateStr, buildUdharPersonPhrase(tx)].filter(Boolean).join(" · ")
  }
  const fromSource = tx.sourceName?.trim()
  const fromId =
    tx.accountId != null
      ? accounts.find((a) => String(a.id) === String(tx.accountId))?.name?.trim()
      : undefined
  const accountPart = fromSource || fromId || ""
  const notePart = tx.subtitle?.trim() || ""
  return [dateStr, accountPart, notePart].filter(Boolean).join(" · ")
}
