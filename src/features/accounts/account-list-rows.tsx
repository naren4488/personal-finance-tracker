import { ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { AccountListItem } from "@/features/accounts/accounts-mock-data"
import type { Person } from "@/lib/api/people-schemas"
import { cn } from "@/lib/utils"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatSignedInr(amountInr: number): { text: string; positive: boolean; zero: boolean } {
  if (amountInr === 0) {
    return { text: "₹0", positive: true, zero: true }
  }
  const positive = amountInr > 0
  const abs = Math.abs(amountInr)
  const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)
  return {
    text: `${positive ? "+" : "-"}₹${num}`,
    positive,
    zero: false,
  }
}

export function AccountRowCard({ item }: { item: AccountListItem }) {
  const { text, positive, zero } = formatSignedInr(item.amountInr)
  const subParts: string[] = [`${item.entryCount} ${item.entryCount === 1 ? "entry" : "entries"}`]
  if (item.subtitle) subParts.push(item.subtitle)
  else if (item.payBy) subParts.push(`Pay by: ${item.payBy}`)

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm",
        "transition-colors hover:bg-muted/40 active:bg-muted/60",
        "min-h-18"
      )}
    >
      <Avatar className="size-11 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/40">
        <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
          {initialsFromName(item.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subParts.join(" • ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "text-right text-base font-bold tabular-nums tracking-tight",
            zero && "text-muted-foreground",
            !zero && positive && "text-income",
            !zero && !positive && "text-destructive"
          )}
        >
          {text}
        </span>
        <ChevronRight className="size-4 text-muted-foreground/70" strokeWidth={2} aria-hidden />
      </div>
    </button>
  )
}

export function PeopleApiRow({
  person,
  balanceRow,
}: {
  person: Person
  balanceRow?: AccountListItem
}) {
  const { text, positive, zero } = formatSignedInr(balanceRow?.amountInr ?? 0)
  const entryCount = balanceRow?.entryCount ?? 0

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm",
        "min-h-18"
      )}
    >
      <Avatar className="size-11 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/40">
        <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
          {initialsFromName(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{person.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{person.phoneNumber?.trim() || "—"}</p>
        {(entryCount > 0 || balanceRow?.payBy) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
            {balanceRow?.payBy ? ` · Pay by: ${balanceRow.payBy}` : ""}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            "text-right text-base font-bold tabular-nums tracking-tight",
            zero && "text-muted-foreground",
            !zero && positive && "text-income",
            !zero && !positive && "text-destructive"
          )}
        >
          {text}
        </span>
        <ChevronRight className="size-4 text-muted-foreground/70" strokeWidth={2} aria-hidden />
      </div>
    </div>
  )
}
