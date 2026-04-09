import { useMemo } from "react"
import { CalendarDays, ChevronRight, Landmark } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Account } from "@/lib/api/account-schemas"
import { mapAccountToLoanView, type LoanViewModel } from "@/lib/api/loan-account-map"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

function LoanRowAccounts({
  account,
  model,
  onSelect,
}: {
  account: Account
  model: LoanViewModel
  onSelect?: (account: Account) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm",
        "min-h-18 transition-colors hover:bg-muted/40 active:bg-muted/60"
      )}
      onClick={() => onSelect?.(account)}
    >
      <Avatar className="size-11 shrink-0 border-0 bg-muted/80">
        <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
          <Landmark className="size-5 text-primary" strokeWidth={2} aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{model.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{model.accountsRowMeta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="text-right">
          <p className="text-base font-bold tabular-nums tracking-tight text-destructive">
            {formatCurrency(model.outstanding)}
          </p>
          <p className="text-[11px] text-muted-foreground">remaining</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/70" strokeWidth={2} aria-hidden />
      </div>
    </button>
  )
}

function LoanTileEntries({
  account,
  model,
  onSelect,
  onPayEmi,
}: {
  account: Account
  model: LoanViewModel
  onSelect?: (account: Account) => void
  onPayEmi?: (account: Account) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <button
        type="button"
        className="w-full border-b border-border/80 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/30 sm:px-4 sm:py-3.5"
        onClick={() => onSelect?.(account)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-bold text-foreground sm:text-lg">
                {model.name}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs",
                  model.isActive
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {model.statusLabel}
              </span>
            </div>
            {model.subtitleLine ? (
              <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
                {model.subtitleLine}
              </p>
            ) : null}
          </div>
          <Landmark
            className="size-6 shrink-0 text-primary sm:size-7"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          {model.emiAmount != null ? (
            <p className="font-semibold text-foreground">
              EMI:{" "}
              <span className="tabular-nums text-foreground">
                {formatCurrency(model.emiAmount)}
              </span>
            </p>
          ) : null}
          {model.tenure > 0 ? (
            <p className="text-muted-foreground">
              Paid:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {model.paid}/{model.tenure}
              </span>
            </p>
          ) : null}
        </div>

        {model.emiDueDateLabel ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100/90 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
            <CalendarDays className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              Upcoming EMI due: <span className="font-semibold">{model.emiDueDateLabel}</span>
            </span>
          </div>
        ) : null}
      </button>

      <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full rounded-xl font-semibold"
          onClick={(e) => {
            e.stopPropagation()
            onPayEmi?.(account)
          }}
        >
          Pay EMI
        </Button>
      </div>
    </div>
  )
}

export type LoanListProps = {
  accounts: Account[]
  variant: "entries" | "accounts"
  onSelectLoan?: (account: Account) => void
  /** Entries tile: Pay EMI → same flow as loan detail Pay EMI */
  onPayEmi?: (account: Account) => void
}

export function LoanList({ accounts, variant, onSelectLoan, onPayEmi }: LoanListProps) {
  const rows = useMemo(
    () => accounts.map((account) => ({ account, model: mapAccountToLoanView(account) })),
    [accounts]
  )

  return (
    <ul className="flex list-none flex-col gap-2.5" aria-label="Loans list">
      {rows.map(({ account, model }) => (
        <li key={account.id}>
          {variant === "accounts" ? (
            <LoanRowAccounts account={account} model={model} onSelect={onSelectLoan} />
          ) : (
            <LoanTileEntries
              account={account}
              model={model}
              onSelect={onSelectLoan}
              onPayEmi={onPayEmi}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export type { LoanViewModel }
