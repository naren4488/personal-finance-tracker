import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ArrowLeft, Check, ChevronDown, CreditCard, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import { formatOpeningBalanceForApi } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import {
  billCycleLabelFromDay,
  billGenerationDayNumber,
  creditCardLimitInr,
  creditCardOutstandingInr,
  dayOfMonthOrdinal,
  interestRatePercentFromAccount,
  mapAccountToCreditCardView,
  maskedCardNumberDisplay,
  paymentDueDayNumber,
} from "@/lib/api/credit-card-map"
import { AddCardSpendSheet } from "@/features/accounts/add-card-spend-sheet"
import { getAccountDeleteWarning } from "@/lib/accounts/account-delete"
import { formatCurrency } from "@/lib/format"
import { useDeleteAccountMutation, useUpdateAccountMutation } from "@/store/api/base-api"
import { cn } from "@/lib/utils"

const CARD_NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "rupay", label: "RuPay" },
  { value: "american_express", label: "American Express" },
  { value: "other", label: "Other" },
] as const

const BILL_DAY_OPTIONS: { value: string; label: string }[] = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1
  return { value: String(d), label: dayOfMonthOrdinal(d) }
})

function comingSoon(label: string) {
  toast.message("Coming soon", { description: `${label} will be available soon.` })
}

const statTileClass = "rounded-xl bg-inherit px-2 py-3 text-center sm:px-3"

const billingTileClass = "rounded-xl bg-inherit px-3 py-3"

function asRec(a: Account): Record<string, unknown> {
  return a as unknown as Record<string, unknown>
}

function cloneAccount(a: Account): Account {
  try {
    return JSON.parse(JSON.stringify(a)) as Account
  } catch {
    return { ...a } as Account
  }
}

function parseDigitsInt(s: string): number {
  const n = Number(s.replace(/\D/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function CreditCardDetailView({
  open,
  onOpenChange,
  account,
  onCardUpdated,
  onPayBill,
  onCardDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  onCardUpdated?: (account: Account) => void
  /** Pay Bill — opens shared Add Transaction (transfer → credit card bill). */
  onPayBill?: () => void
  onCardDeleted?: () => void
}) {
  const navigate = useNavigate()
  const [updateAccount, { isLoading: isSaving }] = useUpdateAccountMutation()
  const [deleteAccount, { isLoading: isDeletingAccount }] = useDeleteAccountMutation()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Account | null>(null)
  const [spendOpen, setSpendOpen] = useState(false)

  const dismiss = useCallback(() => {
    setIsEditing(false)
    setDraft(null)
    setSpendOpen(false)
    setDeleteConfirmOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraft(null)
  }, [])

  const startEdit = useCallback(() => {
    if (!account) return
    const d = cloneAccount(account)
    const rec = asRec(d)
    const m = mapAccountToCreditCardView(account)
    if (rec.cardNetwork == null || String(rec.cardNetwork).trim() === "") {
      rec.cardNetwork = m.cardNetwork ?? ""
    }
    const l4 = String(rec.last4Digits ?? m.last4Digits ?? "")
      .replace(/\D/g, "")
      .slice(-4)
    rec.last4Digits = l4.length === 4 ? l4 : l4
    const limit = creditCardLimitInr(account)
    if (limit > 0) {
      rec.creditLimit = String(Math.round(limit))
    }
    const bg = billGenerationDayNumber(account)
    if (bg != null) rec.billGenerationDay = String(bg)
    const pd = paymentDueDayNumber(account)
    if (pd != null) rec.paymentDueDay = String(pd)
    setDraft(d)
    setIsEditing(true)
  }, [account])

  const saveEdit = useCallback(async () => {
    if (!draft || !account) return
    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Unable to update card: missing account id")
      return
    }
    const name = draft.name?.trim() ?? ""
    if (!name) {
      toast.error("Enter card name")
      return
    }
    const rec = asRec(draft)
    const bankName = typeof rec.bankName === "string" ? rec.bankName.trim() : ""
    if (!bankName) {
      toast.error("Enter bank name")
      return
    }
    const network = String(rec.cardNetwork ?? "")
      .trim()
      .toLowerCase()
    if (!network) {
      toast.error("Select card network")
      return
    }
    const l4 = String(rec.last4Digits ?? "").replace(/\D/g, "")
    if (l4.length !== 4) {
      toast.error("Enter last 4 digits")
      return
    }
    const limitDigits = String(rec.creditLimit ?? "").replace(/\D/g, "")
    if (!limitDigits || Number(limitDigits) <= 0) {
      toast.error("Enter valid credit limit")
      return
    }
    const billDay = parseDigitsInt(String(rec.billGenerationDay ?? ""))
    if (billDay < 1 || billDay > 31) {
      toast.error("Bill generation day must be 1–31")
      return
    }
    const payDay = parseDigitsInt(String(rec.paymentDueDay ?? ""))
    if (payDay < 1 || payDay > 31) {
      toast.error("Payment due day must be 1–31")
      return
    }

    const isActive = typeof rec.isActive === "boolean" ? rec.isActive : true

    const payload: Record<string, unknown> = {
      name,
      bankName,
      cardNetwork: network,
      last4Digits: l4,
      creditLimit: formatOpeningBalanceForApi(Number(limitDigits)),
      billGenerationDay: String(billDay),
      paymentDueDay: String(payDay),
      isActive,
    }

    const next = {
      ...draft,
      name,
      bankName,
      cardNetwork: network,
      last4Digits: l4,
      creditLimit: limitDigits,
      billGenerationDay: String(billDay),
      paymentDueDay: String(payDay),
      isActive,
    } as Account

    try {
      console.log("[credit-card] saving to backend", {
        method: "PUT",
        path: `/accounts/${accountId}`,
        accountId,
        payload,
      })
      console.log(
        "[credit-card] backend body (JSON exactly as sent):",
        JSON.stringify(payload, null, 2)
      )
      const updated = await updateAccount({ id: accountId, body: payload }).unwrap()
      console.log("[credit-card] update success", {
        id: accountId,
        account: updated.account ?? null,
        message: updated.message ?? "Card updated successfully",
      })
      onCardUpdated?.((updated.account as Account | undefined) ?? next)
      toast.success("Card updated successfully")
      setIsEditing(false)
      setDraft(null)
    } catch (error) {
      console.error("[credit-card] update failed", { id: accountId, error })
      const msg = getErrorMessage(error)
      if (/authorization token is required/i.test(msg)) {
        toast.error("Session expired, please login again")
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg || "Failed to update card")
    }
  }, [account, draft, navigate, onCardUpdated, updateAccount])

  const confirmDeleteCard = useCallback(async () => {
    if (!account) return
    const id = String(account.id ?? "").trim()
    if (!id) {
      toast.error("Unable to delete: missing account id")
      return
    }
    try {
      const res = await deleteAccount(id).unwrap()
      toast.success(res.message ?? "Card deleted")
      setDeleteConfirmOpen(false)
      setSpendOpen(false)
      setIsEditing(false)
      setDraft(null)
      onOpenChange(false)
      onCardDeleted?.()
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete")
    }
  }, [account, deleteAccount, onCardDeleted, onOpenChange])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (isEditing) cancelEdit()
      else dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, isEditing, cancelEdit, dismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const networkOptions = useMemo(() => {
    if (!draft) return [...CARD_NETWORKS]
    const cur = String(asRec(draft).cardNetwork ?? "")
      .trim()
      .toLowerCase()
    if (cur && !CARD_NETWORKS.some((o) => o.value === cur)) {
      return [{ value: cur, label: cur.replace(/_/g, " ") }, ...CARD_NETWORKS]
    }
    return [...CARD_NETWORKS]
  }, [draft])

  if (!open || !account) return null

  const working = isEditing && draft ? draft : account
  const model = mapAccountToCreditCardView(working)
  const limit = creditCardLimitInr(working)
  const outstanding = creditCardOutstandingInr(working)
  const available = Math.max(0, limit - outstanding)
  const usedPercent =
    limit > 0 ? Math.min(100, Math.max(0, Math.round((100 * outstanding) / limit))) : 0

  const masked = maskedCardNumberDisplay(model.last4Digits)
  const networkDisplay = model.cardNetwork ? model.cardNetwork.replace(/_/g, " ").toUpperCase() : ""
  const subtitleParts = [model.bankName, networkDisplay].filter(Boolean)
  const subtitle = subtitleParts.join(" · ")

  const billGenDay = billGenerationDayNumber(working)
  const billGenLabel = billCycleLabelFromDay(billGenDay)
  const payDueDay = paymentDueDayNumber(working)
  const payDueLabel = billCycleLabelFromDay(payDueDay)

  const rate = interestRatePercentFromAccount(working)

  function patchDraft(patch: Record<string, unknown>) {
    setDraft((d) => (d ? ({ ...d, ...patch } as Account) : d))
  }

  const fieldIn = cn(
    "mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm outline-none",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
  )

  const labelSm = "text-[10px] font-medium text-muted-foreground sm:text-xs"

  const deleteWarning = getAccountDeleteWarning(account)

  return (
    <>
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete credit card"
        warning={deleteWarning}
        isDeleting={isDeletingAccount}
        onConfirm={confirmDeleteCard}
      />
      <AddCardSpendSheet open={spendOpen} onOpenChange={setSpendOpen} account={account} />
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
                      aria-label={isEditing ? "Editing card" : "Edit card"}
                      disabled={isEditing}
                      onClick={startEdit}
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

            {isEditing && draft ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:mt-5">
                <h2 className="mb-3 text-base font-bold text-foreground">Edit Card</h2>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="cc-edit-name" className={labelSm}>
                      Card Name
                    </Label>
                    <Input
                      id="cc-edit-name"
                      value={draft.name}
                      onChange={(e) => patchDraft({ name: e.target.value })}
                      className={cn(fieldIn, "h-10 text-left")}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className={labelSm}>Credit Limit (₹)</Label>
                      <Input
                        inputMode="numeric"
                        value={String(asRec(draft).creditLimit ?? "").replace(/\D/g, "")}
                        onChange={(e) =>
                          patchDraft({ creditLimit: e.target.value.replace(/\D/g, "") })
                        }
                        className={cn(fieldIn, "h-10 text-left tabular-nums")}
                      />
                    </div>
                    <div>
                      <Label className={labelSm}>Bank Name</Label>
                      <Input
                        value={String(asRec(draft).bankName ?? "")}
                        onChange={(e) => patchDraft({ bankName: e.target.value })}
                        className={cn(fieldIn, "h-10 text-left")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="cc-edit-network" className={labelSm}>
                        Card network
                      </Label>
                      <div className="relative mt-1">
                        <select
                          id="cc-edit-network"
                          value={String(asRec(draft).cardNetwork ?? "").toLowerCase()}
                          onChange={(e) => patchDraft({ cardNetwork: e.target.value })}
                          className={cn(
                            fieldIn,
                            "h-10 w-full appearance-none bg-background pl-2 pr-9 text-left capitalize"
                          )}
                        >
                          <option value="">Select network</option>
                          {networkOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                    </div>
                    <div>
                      <Label className={labelSm}>Last 4 digits</Label>
                      <Input
                        inputMode="numeric"
                        maxLength={4}
                        value={String(asRec(draft).last4Digits ?? "")
                          .replace(/\D/g, "")
                          .slice(0, 4)}
                        onChange={(e) =>
                          patchDraft({ last4Digits: e.target.value.replace(/\D/g, "").slice(0, 4) })
                        }
                        className={cn(fieldIn, "h-10 text-left tabular-nums tracking-widest")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="cc-edit-bill-day" className={labelSm}>
                        Bill Generation Day
                      </Label>
                      <div className="relative mt-1">
                        <select
                          id="cc-edit-bill-day"
                          value={(() => {
                            const n = parseDigitsInt(String(asRec(draft).billGenerationDay ?? ""))
                            return n >= 1 && n <= 31 ? String(n) : ""
                          })()}
                          onChange={(e) => patchDraft({ billGenerationDay: e.target.value })}
                          className={cn(
                            fieldIn,
                            "h-10 w-full appearance-none bg-background pl-2 pr-9 text-left"
                          )}
                        >
                          <option value="">Select day</option>
                          {BILL_DAY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="cc-edit-pay-day" className={labelSm}>
                        Payment Due Day
                      </Label>
                      <div className="relative mt-1">
                        <select
                          id="cc-edit-pay-day"
                          value={(() => {
                            const n = parseDigitsInt(String(asRec(draft).paymentDueDay ?? ""))
                            return n >= 1 && n <= 31 ? String(n) : ""
                          })()}
                          onChange={(e) => patchDraft({ paymentDueDay: e.target.value })}
                          className={cn(
                            fieldIn,
                            "h-10 w-full appearance-none bg-background pl-2 pr-9 text-left"
                          )}
                        >
                          <option value="">Select day</option>
                          {BILL_DAY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    className="h-11 min-h-11 min-w-0 flex-3 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:text-base"
                    onClick={saveEdit}
                    disabled={isSaving}
                  >
                    <Check className="mr-2 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-[28%] shrink-0 rounded-xl border-border px-3 text-sm font-semibold sm:px-4"
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    <X className="mr-1.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

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

              {!isEditing ? (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-xl border-0 bg-inherit font-semibold text-foreground shadow-none hover:bg-muted/40"
                    onClick={() => setSpendOpen(true)}
                  >
                    Add Spend
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground shadow-none hover:bg-primary/90"
                    onClick={() => onPayBill?.()}
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
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                    Delete
                  </Button>
                </div>
              ) : null}
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
    </>
  )
}
