import { useState } from "react"
import { ChevronRight, CreditCard, Landmark, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ACCOUNTS_MOCK_BY_SEGMENT,
  ACCOUNTS_SEGMENT_META,
  type AccountsSegmentId,
  type AccountListItem,
} from "@/features/accounts/accounts-mock-data"
import { cn } from "@/lib/utils"

const SEGMENT_ORDER: AccountsSegmentId[] = ["accounts", "people", "loans", "cards"]

const SEGMENT_ICONS: Record<AccountsSegmentId, typeof Users> = {
  accounts: Wallet,
  people: Users,
  loans: Landmark,
  cards: CreditCard,
}

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

function AccountRowCard({ item }: { item: AccountListItem }) {
  const { text, positive, zero } = formatSignedInr(item.amountInr)
  const subParts: string[] = [`${item.entryCount} ${item.entryCount === 1 ? "entry" : "entries"}`]
  if (item.payBy) subParts.push(`Pay by: ${item.payBy}`)

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

export default function AccountsPage() {
  const [segment, setSegment] = useState<AccountsSegmentId>("people")
  const meta = ACCOUNTS_SEGMENT_META[segment]
  const items = ACCOUNTS_MOCK_BY_SEGMENT[segment]

  return (
    <main className="min-h-0 flex-1 bg-background px-4 py-4 pb-28">
      <div
        className="mb-4 flex gap-1 rounded-2xl bg-muted/70 p-1 dark:bg-muted/50"
        role="tablist"
        aria-label="Accounts categories"
      >
        {SEGMENT_ORDER.map((id) => {
          const Icon = SEGMENT_ICONS[id]
          const active = segment === id
          const { label } = ACCOUNTS_SEGMENT_META[id]
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`accounts-tab-${id}`}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors sm:flex-row sm:text-xs",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSegment(id)}
            >
              <Icon
                className="size-4 shrink-0 sm:size-3.5"
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden
              />
              <span className="leading-none">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-foreground">{meta.listTitle}</h1>
        <Button
          type="button"
          variant="link"
          className="h-auto shrink-0 p-0 text-sm font-semibold text-primary"
        >
          + Add
        </Button>
      </div>

      <ul className="flex list-none flex-col gap-2.5" aria-label={`${meta.listTitle} list`}>
        {items.map((item) => (
          <li key={item.id}>
            <AccountRowCard item={item} />
          </li>
        ))}
      </ul>
    </main>
  )
}
