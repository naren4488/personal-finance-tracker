import { useMemo } from "react"
import { CalendarDays, ChevronRight, CreditCard } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Account } from "@/lib/api/account-schemas"
import { mapAccountToCreditCardView, type CreditCardViewModel } from "@/lib/api/credit-card-map"
import { formatCurrency } from "@/lib/format"
import {
  EntityListCardLetterAvatar,
  EntityListCardShell,
} from "@/features/accounts/entity-list-card"
import {
  entityListCardAvatarLetter,
  entityListCardFooterBtnClass,
} from "@/features/accounts/entity-list-card-styles"
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
        "flex w-full items-center gap-2.5 rounded-2xl border border-border/80 bg-card px-3 py-2 text-left shadow-sm",
        "min-h-14 transition-colors hover:bg-muted/40 active:bg-muted/60"
      )}
      onClick={onPress}
    >
      <Avatar className="size-9 shrink-0 border-0 bg-muted/80">
        <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
          <CreditCard className="size-4 text-primary" strokeWidth={2} aria-hidden />
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
          <p className="text-sm font-bold tabular-nums tracking-tight text-destructive sm:text-base">
            {formatCurrency(model.outstanding)}
          </p>
          <p className="text-[11px] text-muted-foreground">outstanding</p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/70" strokeWidth={2} aria-hidden />
      </div>
    </button>
  )
}

function creditCardSubtitle(model: CreditCardViewModel): string | null {
  const lines: string[] = []
  if (model.bankName) lines.push(model.bankName)
  if (model.last4Digits) {
    lines.push(`•••• ${model.last4Digits}${model.cardNetwork ? ` · ${model.cardNetwork}` : ""}`)
  } else if (model.cardNetwork) {
    lines.push(model.cardNetwork)
  }
  return lines.length > 0 ? lines.join(" · ") : null
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
  const name = model.name?.trim() || "Card"

  return (
    <EntityListCardShell
      onOpen={() => onOpenDetail?.()}
      openAriaLabel={`Open ${name}`}
      avatar={<EntityListCardLetterAvatar letter={entityListCardAvatarLetter(name)} />}
      title={name}
      subtitle={creditCardSubtitle(model)}
      metric={
        <>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
            {formatCurrency(model.creditLimit)}
          </p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">Credit limit</p>
        </>
      }
      headerExtra={
        <>
          {model.dueDateLabel ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-100/90 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
              <CalendarDays className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                Payment due date: <span className="font-semibold">{model.dueDateLabel}</span>
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-foreground">Used {model.usedPercent}%</span>
            <span className="font-bold tabular-nums text-foreground">
              {formatCurrency(model.outstanding)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-income transition-[width] duration-300"
              style={{ width: `${model.usedPercent}%` }}
            />
          </div>
        </>
      }
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={entityListCardFooterBtnClass}
            onClick={(e) => {
              e.stopPropagation()
              onAddSpend?.(account)
            }}
          >
            Add Spend
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className={entityListCardFooterBtnClass}
            onClick={(e) => {
              e.stopPropagation()
              onPayBill?.(account)
            }}
          >
            Pay Bill
          </Button>
        </>
      }
    />
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
