import { useCallback, useEffect } from "react"
import { Archive, ArrowLeft, CreditCard, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { Account } from "@/lib/api/account-schemas"
import {
  billCycleLabelFromDay,
  billGenerationDayNumber,
  creditCardLimitInr,
  creditCardOutstandingInr,
  interestRatePercentFromAccount,
  mapAccountToCreditCardView,
  maskedCardNumberDisplay,
  paymentDueDayNumber,
} from "@/lib/api/credit-card-map"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

function comingSoon(label: string) {
  toast.message("Coming soon", { description: `${label} will be available soon.` })
}

const statTileClass = "rounded-xl bg-inherit px-2 py-3 text-center sm:px-3"

const billingTileClass = "rounded-xl bg-inherit px-3 py-3"

export function CreditCardDetailView({
  open,
  onOpenChange,
  account,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}) {
  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, dismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !account) return null

  const model = mapAccountToCreditCardView(account)
  const limit = creditCardLimitInr(account)
  const outstanding = creditCardOutstandingInr(account)
  const available = Math.max(0, limit - outstanding)
  const usedPercent =
    limit > 0 ? Math.min(100, Math.max(0, Math.round((100 * outstanding) / limit))) : 0

  const masked = maskedCardNumberDisplay(model.last4Digits)
  const networkDisplay = model.cardNetwork ? model.cardNetwork.replace(/_/g, " ").toUpperCase() : ""
  const subtitleParts = [model.bankName, networkDisplay].filter(Boolean)
  const subtitle = subtitleParts.join(" · ")

  const billGenDay = billGenerationDayNumber(account)
  const billGenLabel = billCycleLabelFromDay(billGenDay)
  const payDueDay = paymentDueDayNumber(account)
  const payDueLabel = billCycleLabelFromDay(payDueDay)

  const rate = interestRatePercentFromAccount(account)

  return (
    <div className="fixed inset-0 z-60 flex items-stretch justify-center sm:items-center sm:p-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-detail-card-name"
        className={cn(
          "relative z-10 flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden bg-background shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:rounded-2xl"
        )}
      >
        {/* Top bar: Back only (reference — title lives in navy card) */}
        <div className="shrink-0 px-4 pb-1 pt-3 sm:px-5 sm:pt-4">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Back
          </button>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-6 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-5 sm:pb-8"
          )}
        >
          {/* Navy hero — Image 1: name row → masked number → limit | due */}
          <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-md">
            <div className="px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    id="cc-detail-card-name"
                    className="truncate text-xl font-bold tracking-tight sm:text-2xl"
                  >
                    {model.name}
                  </p>
                  {subtitle ? (
                    <p className="mt-1 truncate text-sm font-medium text-primary-foreground/80">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-9 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15"
                    aria-label="Edit card"
                    onClick={() => comingSoon("Edit card")}
                  >
                    <Pencil className="size-[18px]" strokeWidth={2} aria-hidden />
                  </Button>
                  <span className="flex size-9 items-center justify-center" aria-hidden>
                    <CreditCard className="size-6 text-primary-foreground/95" strokeWidth={2} />
                  </span>
                </div>
              </div>

              {masked ? (
                <p className="mt-5 text-center text-sm font-medium tracking-[0.12em] text-primary-foreground sm:mt-6 sm:text-base">
                  {masked}
                </p>
              ) : (
                <div className="mt-5 sm:mt-6" />
              )}

              <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mt-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/70">
                    Credit Limit
                  </p>
                  <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums sm:text-4xl">
                    {formatCurrency(limit)}
                  </p>
                </div>
                {model.dueDateLabel ? (
                  <div className="min-w-0 text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/70">
                      Next Due Date
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-primary-foreground sm:text-xl">
                      {model.dueDateLabel}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* White body — single column, reference spacing */}
          <div className="mt-4 space-y-4 rounded-2xl bg-inherit p-4 sm:mt-5 sm:p-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Used {usedPercent}%</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(outstanding)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-income transition-[width] duration-300"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className={statTileClass}>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  Outstanding
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-destructive sm:text-base">
                  {formatCurrency(outstanding)}
                </p>
              </div>
              <div className={statTileClass}>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  Available
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-income sm:text-base">
                  {formatCurrency(available)}
                </p>
              </div>
              {rate !== null ? (
                <div className={statTileClass}>
                  <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Rate</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                    {rate}%
                  </p>
                </div>
              ) : (
                <div className={statTileClass}>
                  <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Rate</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                    —
                  </p>
                </div>
              )}
            </div>

            {(billGenLabel || payDueLabel) && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                {billGenLabel ? (
                  <div className={billingTileClass}>
                    <p className="text-xs font-medium text-muted-foreground">Bill Generation</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{billGenLabel}</p>
                  </div>
                ) : null}
                {payDueLabel ? (
                  <div className={billingTileClass}>
                    <p className="text-xs font-medium text-muted-foreground">Payment Due</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{payDueLabel}</p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl border-0 bg-inherit font-semibold text-foreground shadow-none hover:bg-muted/40"
                onClick={() => comingSoon("Add spend")}
              >
                Add Spend
              </Button>
              <Button
                type="button"
                className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground shadow-none hover:bg-primary/90"
                onClick={() => comingSoon("Pay bill")}
              >
                Pay Bill
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl border-0 bg-inherit font-semibold text-foreground shadow-none hover:bg-muted/40"
                onClick={() => comingSoon("Archive card")}
              >
                <Archive className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                Archive
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-12 rounded-xl font-semibold shadow-none"
                onClick={() => comingSoon("Delete card")}
              >
                <Trash2 className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                Delete
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-inherit p-4 sm:mt-5 sm:p-5">
            <h2 className="text-base font-bold text-foreground">Transactions</h2>
            <p className="mt-8 pb-2 text-center text-sm text-muted-foreground">
              No transactions yet
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-inherit p-4 sm:mt-5 sm:p-5">
            <h2 className="text-base font-bold text-foreground">Payments Made</h2>
            <p className="mt-8 pb-2 text-center text-sm text-muted-foreground">No payments yet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
