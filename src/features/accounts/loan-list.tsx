import { useMemo } from "react"
import { CalendarDays, ChevronRight, Landmark } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Account } from "@/lib/api/account-schemas"
import {
  loanPaidEmiListLabel,
  mapAccountToLoanView,
  type LoanViewModel,
} from "@/lib/api/loan-account-map"
import { formatCurrency } from "@/lib/format"
import {
  EntityListCardActiveBadge,
  EntityListCardLetterAvatar,
  EntityListCardShell,
} from "@/features/accounts/entity-list-card"
import { entityListCardAvatarLetter } from "@/features/accounts/entity-list-card-styles"
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
}: {
  account: Account
  model: LoanViewModel
  onSelect?: (account: Account) => void
}) {
  const name = model.name?.trim() || "Loan"

  return (
    <EntityListCardShell
      onOpen={() => onSelect?.(account)}
      openAriaLabel={`Open ${name}`}
      avatar={<EntityListCardLetterAvatar letter={entityListCardAvatarLetter(name)} />}
      title={name}
      subtitle={model.subtitleLine || null}
      metric={
        model.emiAmount != null ? (
          <>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
              {formatCurrency(model.emiAmount)}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">EMI</p>
          </>
        ) : null
      }
      headerExtra={
        <>
          {model.tenure > 0 || model.paid > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {loanPaidEmiListLabel(
                  model.paid,
                  model.tenure > 0 ? model.remainingTenure : undefined
                )}
              </span>
            </p>
          ) : null}
          {model.emiDueDateLabel ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-100/90 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
              <CalendarDays className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                Upcoming EMI due: <span className="font-semibold">{model.emiDueDateLabel}</span>
              </span>
            </div>
          ) : null}
        </>
      }
      footer={<EntityListCardActiveBadge active={model.isActive} label={model.statusLabel} />}
    />
  )
}

export type LoanListProps = {
  accounts: Account[]
  variant: "entries" | "accounts"
  onSelectLoan?: (account: Account) => void
}

export function LoanList({ accounts, variant, onSelectLoan }: LoanListProps) {
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
            <LoanTileEntries account={account} model={model} onSelect={onSelectLoan} />
          )}
        </li>
      ))}
    </ul>
  )
}

export type { LoanViewModel }
