import { useMemo } from "react"
import { CalendarDays, ChevronRight, CreditCard } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Account } from "@/lib/api/account-schemas"
import { mapAccountToCreditCardView, type CreditCardViewModel } from "@/lib/api/credit-card-map"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

function CreditCardRowAccounts({
  model,
  onPress,
}: {
  model: CreditCardViewModel
  onPress?: () => void
}) {
  const subParts: string[] = []
  if (model.bankName) subParts.push(model.bankName)
  if (model.dueDateLabel) subParts.push(`Due: ${model.dueDateLabel}`)
  const subtitle = subParts.join(" · ")

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm",
        "min-h-18 transition-colors hover:bg-muted/40 active:bg-muted/60"
      )}
      onClick={onPress}
    >
      <Avatar className="size-11 shrink-0 border-0 bg-muted/80">
        <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
          <CreditCard className="size-5 text-primary" strokeWidth={2} aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{model.name}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="text-right">
          <p className="text-base font-bold tabular-nums tracking-tight text-destructive">
            {formatCurrency(model.outstanding)}
          </p>
          <p className="text-[11px] text-muted-foreground">outstanding</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/70" strokeWidth={2} aria-hidden />
      </div>
    </button>
  )
}

function CreditCardTileEntries({
  model,
  account,
  onOpenDetail,
  onAddSpend,
  onPayBill,
}: {
  model: CreditCardViewModel
  account: Account
  onOpenDetail?: () => void
  onAddSpend?: (account: Account) => void
  onPayBill?: (account: Account) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <button
        type="button"
        className="w-full bg-primary px-3 py-3 text-left text-primary-foreground transition-colors hover:bg-primary/95 sm:px-4 sm:py-3.5"
        onClick={onOpenDetail}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold sm:text-lg">{model.name}</p>
            {model.bankName ? (
              <p className="mt-0.5 truncate text-sm font-medium text-primary-foreground/85">
                {model.bankName}
              </p>
            ) : null}
            {model.last4Digits ? (
              <p className="mt-0.5 text-xs text-primary-foreground/75">
                •••• {model.last4Digits}
                {model.cardNetwork ? ` · ${model.cardNetwork}` : ""}
              </p>
            ) : null}
          </div>
          <CreditCard className="size-7 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">
          {formatCurrency(model.creditLimit)}
        </p>
        <p className="text-xs font-medium text-primary-foreground/80">Credit limit</p>
      </button>

      <div className="space-y-3 bg-card px-3 py-3 sm:px-4 sm:py-4">
        {model.dueDateLabel ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-100/90 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
            <CalendarDays className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>
              Payment due date: <span className="font-semibold">{model.dueDateLabel}</span>
            </span>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-foreground">Used {model.usedPercent}%</span>
          <span className="font-bold tabular-nums text-foreground">
            {formatCurrency(model.outstanding)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-income transition-[width] duration-300"
            style={{ width: `${model.usedPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-primary text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation()
              onAddSpend?.(account)
            }}
          >
            Add Spend
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation()
              onPayBill?.(account)
            }}
          >
            Pay Bill
          </Button>
        </div>
      </div>
    </div>
  )
}

export type CreditCardListProps = {
  accounts: Account[]
  variant: "entries" | "accounts"
  onSelectCard?: (account: Account) => void
  onAddSpend?: (account: Account) => void
  onPayBill?: (account: Account) => void
}

export function CreditCardList({
  accounts,
  variant,
  onSelectCard,
  onAddSpend,
  onPayBill,
}: CreditCardListProps) {
  const rows = useMemo(
    () => accounts.map((account) => ({ account, model: mapAccountToCreditCardView(account) })),
    [accounts]
  )

  return (
    <ul className="flex list-none flex-col gap-2.5" aria-label="Credit cards list">
      {rows.map(({ account, model }) => (
        <li key={account.id}>
          {variant === "accounts" ? (
            <CreditCardRowAccounts model={model} onPress={() => onSelectCard?.(account)} />
          ) : (
            <CreditCardTileEntries
              model={model}
              account={account}
              onOpenDetail={() => onSelectCard?.(account)}
              onAddSpend={onAddSpend}
              onPayBill={onPayBill}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export type { CreditCardViewModel }
