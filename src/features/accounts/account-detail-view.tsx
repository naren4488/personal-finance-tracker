import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ArrowLeft, Banknote, Check, Pencil, Scale, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getAccountDeleteWarning } from "@/lib/accounts/account-delete"
import type { Account } from "@/lib/api/account-schemas"
import {
  accountAvailableBalanceInrFromApi,
  accountBalanceInrFromApi,
  accountSubtitleForList,
  openingBalanceInrFromApi,
} from "@/lib/api/account-schemas"
import { getErrorMessage, isFetchBaseQueryError } from "@/lib/api/errors"
import { RecentTransactionRow } from "@/features/entries/recent-transaction-row"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import { formatCurrency } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import {
  useDeleteAccountMutation,
  useGetAccountsQuery,
  useGetRecentTransactionsQuery,
  useUpdateAccountMutation,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"
import { cn } from "@/lib/utils"

function comingSoon(label: string) {
  toast.message("Coming soon", { description: `${label} will be available soon.` })
}

function txRelatesToAccount(t: RecentTransaction, accountId: string): boolean {
  const id = accountId.trim()
  if (t.accountId === id) return true
  const r = t as unknown as Record<string, unknown>
  if (typeof r.toAccountId === "string" && r.toAccountId === id) return true
  if (typeof r.fromAccountId === "string" && r.fromAccountId === id) return true
  return false
}

function isDateInCurrentMonth(dateStr: string, now: Date): boolean {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function monthInOutForAccount(
  transactions: RecentTransaction[],
  accountId: string,
  now: Date
): { monthIn: number; monthOut: number } {
  let monthIn = 0
  let monthOut = 0
  const id = accountId.trim()
  for (const t of transactions) {
    if (!isDateInCurrentMonth(t.date, now)) continue
    const rec = t as unknown as Record<string, unknown>
    const fromId = typeof rec.fromAccountId === "string" ? rec.fromAccountId : undefined
    const toId = typeof rec.toAccountId === "string" ? rec.toAccountId : undefined
    const amt = Math.abs(parseSignedAmountString(t.signedAmount))

    if (t.type === "income" && t.accountId === id) {
      monthIn += amt
    } else if (t.type === "expense" && t.accountId === id) {
      monthOut += amt
    } else if (t.type === "transfer") {
      if (fromId === id) monthOut += amt
      if (toId === id) monthIn += amt
    }
  }
  return { monthIn, monthOut }
}

/** Edit form + minimal PUT: only these fields are sent (no openingBalance / kind / balances). */
type MinimalAccountEditDraft = {
  name: string
  bankName: string
  isActive: boolean
}

function draftFromAccount(a: Account): MinimalAccountEditDraft {
  return {
    name: a.name?.trim() ?? "",
    bankName: (a.bankName ?? a.provider ?? "").trim(),
    isActive: a.isActive !== false,
  }
}

export function AccountDetailView({
  open,
  onOpenChange,
  account,
  onAccountUpdated,
  initialEditing = false,
  onAccountDeleted,
  onAdjustBalance,
  highlightTransactionId,
  onHighlightTransactionConsumed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  onAccountUpdated?: (account: Account) => void
  /** Set when opening from list card "Edit" (use a distinct `key` on the parent so state remounts). */
  initialEditing?: boolean
  /** Called after successful DELETE /accounts/:id so parent can clear selection. */
  onAccountDeleted?: () => void
  /** Opens adjust-balance sheet (POST /accounts/:id/adjustments). */
  onAdjustBalance?: () => void
  highlightTransactionId?: string | null
  onHighlightTransactionConsumed?: () => void
}) {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [updateAccount, { isLoading: isSaving }] = useUpdateAccountMutation()
  const [deleteAccount, { isLoading: isDeletingAccount }] = useDeleteAccountMutation()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const txDelete = useDeleteTransactionFlow()
  const [isEditing, setIsEditing] = useState(() => Boolean(initialEditing && account))
  const [draft, setDraft] = useState<MinimalAccountEditDraft | null>(() =>
    initialEditing && account ? draftFromAccount(account) : null
  )

  const { data: accountsForRows = [] } = useGetAccountsQuery(undefined, {
    skip: !user || !open,
  })

  const { data: recentTransactions = [] } = useGetRecentTransactionsQuery(
    { limit: 5000 },
    {
      skip: !open || !account,
    }
  )

  const dismiss = useCallback(() => {
    setDeleteConfirmOpen(false)
    setIsEditing(false)
    setDraft(null)
    onOpenChange(false)
  }, [onOpenChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraft(null)
  }, [])

  const startEdit = useCallback(() => {
    if (!account) return
    setDraft(draftFromAccount(account))
    setIsEditing(true)
  }, [account])

  const saveEdit = useCallback(async () => {
    if (!draft || !account) return
    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Unable to update account: missing id")
      return
    }
    const name = draft.name.trim()
    if (!name) {
      toast.error("Enter account name")
      return
    }

    /** Minimal PUT — avoid 400 from strict / unknown fields (no openingBalance, kind, balances). */
    const payload: Record<string, unknown> = {
      name,
      isActive: draft.isActive,
    }
    const bankName = draft.bankName.trim()
    if (bankName) {
      payload.bankName = bankName
    }

    try {
      console.log("[account] PUT minimal body:", JSON.stringify(payload, null, 2))
      const response = await updateAccount({ id: accountId, body: payload }).unwrap()
      const next = (response.account as Account | undefined) ?? {
        ...account,
        name,
        ...(bankName ? { bankName } : {}),
        isActive: draft.isActive,
      }
      onAccountUpdated?.(next)
      toast.success(response.message ?? "Account updated")
      setIsEditing(false)
      setDraft(null)
    } catch (error) {
      console.error("[account] update failed", error)
      const msg = getErrorMessage(error)
      const unauthorized =
        (isFetchBaseQueryError(error) && error.status === 401) ||
        /authorization token is required/i.test(msg)
      if (unauthorized) {
        toast.error("Session expired, please login again")
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg || "Failed to update account")
    }
  }, [account, draft, navigate, onAccountUpdated, updateAccount])

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

  const confirmDeleteAccount = useCallback(async () => {
    if (!account) return
    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Unable to delete: missing account id")
      return
    }
    try {
      const res = await deleteAccount(accountId).unwrap()
      toast.success(res.message ?? "Account deleted")
      setDeleteConfirmOpen(false)
      setIsEditing(false)
      setDraft(null)
      onOpenChange(false)
      onAccountDeleted?.()
    } catch (error) {
      const msg = getErrorMessage(error)
      toast.error(msg || "Failed to delete")
    }
  }, [account, deleteAccount, onAccountDeleted, onOpenChange])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const { monthIn, monthOut } = useMemo(() => {
    if (!account) return { monthIn: 0, monthOut: 0 }
    return monthInOutForAccount(recentTransactions, String(account.id), new Date())
  }, [account, recentTransactions])

  const accountTxs = useMemo(() => {
    if (!account) return []
    const id = String(account.id).trim()
    return recentTransactions
      .filter((t) => txRelatesToAccount(t, id))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 100)
  }, [account, recentTransactions])

  useLayoutEffect(() => {
    if (!open || !account || !highlightTransactionId?.trim()) return
    const id = highlightTransactionId.trim()
    const el = document.getElementById(`account-tx-${id}`)
    if (!el) return
    el.scrollIntoView({ block: "nearest", behavior: "smooth" })
    const t = window.setTimeout(() => onHighlightTransactionConsumed?.(), 2200)
    return () => window.clearTimeout(t)
  }, [open, account, highlightTransactionId, accountTxs, onHighlightTransactionConsumed])

  if (!open || !account) return null

  const headerTitle = isEditing && draft ? draft.name.trim() || account.name : account.name
  const subtitle = accountSubtitleForList(account)

  const labelSm = "text-[10px] font-medium text-muted-foreground sm:text-xs"
  const fieldIn = cn(
    "mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm outline-none",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
  )

  function patchDraft(patch: Partial<MinimalAccountEditDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  const availableBalance = accountAvailableBalanceInrFromApi(account)
  const bookBalance = accountBalanceInrFromApi(account)
  const initialBalance = openingBalanceInrFromApi(account)

  const statTile =
    "rounded-xl border border-border/80 bg-card px-3 py-3 text-center shadow-sm sm:px-4 sm:py-3.5"

  const deleteWarning = account ? getAccountDeleteWarning(account) : null

  return (
    <>
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete account"
        warning={deleteWarning}
        isDeleting={isDeletingAccount}
        onConfirm={confirmDeleteAccount}
      />
      <ConfirmDeleteDialog
        open={txDelete.confirmOpen}
        onOpenChange={(v) => !v && txDelete.dismiss()}
        title="Delete entry"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        isDeleting={txDelete.isDeleting}
        onConfirm={txDelete.confirmDelete}
      />
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
          aria-labelledby="account-detail-name"
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
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-8 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-5 sm:pb-10"
            )}
          >
            <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-md">
              <div className="px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      id="account-detail-name"
                      className="truncate text-xl font-bold tracking-tight sm:text-2xl"
                    >
                      {headerTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-9 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15"
                      aria-label={isEditing ? "Editing account" : "Edit account"}
                      disabled={isEditing}
                      onClick={startEdit}
                    >
                      <Pencil className="size-[18px]" strokeWidth={2} aria-hidden />
                    </Button>
                    <span className="flex size-9 items-center justify-center" aria-hidden>
                      <Banknote className="size-6 text-primary-foreground/95" strokeWidth={2} />
                    </span>
                  </div>
                </div>

                {subtitle ? (
                  <p className="mt-2 truncate text-sm font-medium text-primary-foreground/80">
                    {subtitle}
                  </p>
                ) : null}

                <div className="mt-5 sm:mt-6">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary-foreground/70">
                    Available balance
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
                    {formatCurrency(availableBalance)}
                  </p>
                  {Math.round(bookBalance * 100) !== Math.round(availableBalance * 100) ? (
                    <p className="mt-1 text-xs font-medium text-primary-foreground/75">
                      Book balance: {formatCurrency(bookBalance)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm font-medium text-primary-foreground/85">
                    Initial: {formatCurrency(initialBalance)}
                  </p>
                </div>
              </div>
            </div>

            {isEditing && draft ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-base font-bold text-foreground">Edit Account</h2>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="account-edit-name" className={labelSm}>
                      Name
                    </Label>
                    <Input
                      id="account-edit-name"
                      value={draft.name}
                      onChange={(e) => patchDraft({ name: e.target.value })}
                      className={cn(fieldIn, "mt-1 h-10 text-left")}
                      placeholder="e.g. SBI Savings"
                      autoComplete="off"
                      aria-labelledby="account-detail-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="account-edit-bank" className={labelSm}>
                      Bank / institution
                    </Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                      Optional on save — only included in the request when non-empty. Balance
                      changes: use{" "}
                      <span className="font-medium text-foreground">Adjust balance</span>.
                    </p>
                    <Input
                      id="account-edit-bank"
                      value={draft.bankName}
                      onChange={(e) => patchDraft({ bankName: e.target.value })}
                      className={cn(fieldIn, "mt-1 h-10 text-left")}
                      autoComplete="organization"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Active account</p>
                      <p className="text-xs text-muted-foreground">
                        Inactive accounts stay hidden from most flows
                      </p>
                    </div>
                    <Switch
                      checked={draft.isActive}
                      onCheckedChange={(v) => patchDraft({ isActive: v })}
                      aria-label="Account active"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    className="h-11 min-h-11 min-w-0 flex-3 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:text-base"
                    onClick={() => void saveEdit()}
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

            <div className="mt-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className={statTile}>
                  <p className="text-[11px] font-medium text-muted-foreground">This Month In</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-income">
                    {formatCurrency(monthIn)}
                  </p>
                </div>
                <div className={statTile}>
                  <p className="text-[11px] font-medium text-muted-foreground">This Month Out</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-destructive">
                    {formatCurrency(monthOut)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full rounded-xl border-border font-semibold"
                onClick={() => {
                  if (!account?.id) return
                  navigate(`/transactions/add?accountId=${encodeURIComponent(String(account.id))}`)
                }}
              >
                Add Transaction
              </Button>

              {onAdjustBalance ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-11 w-full rounded-xl border-border font-semibold"
                  onClick={onAdjustBalance}
                >
                  <Scale className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  Adjust balance
                </Button>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl font-semibold"
                  onClick={() => comingSoon("Archive account")}
                >
                  <Archive className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  Archive
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 rounded-xl font-semibold"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  Delete
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <h2 className="mb-3 text-base font-bold text-foreground">Recent Transactions</h2>
              {accountTxs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No transactions for this account yet.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-2" aria-label="Account transactions">
                  {accountTxs.map((tx) => {
                    const hid = highlightTransactionId?.trim()
                    const isNew = Boolean(hid && String(tx.id) === hid)
                    return (
                      <li key={tx.id} id={`account-tx-${String(tx.id)}`}>
                        <RecentTransactionRow
                          tx={tx}
                          accounts={accountsForRows}
                          onDelete={txDelete.requestDelete}
                          className={
                            isNew
                              ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
                              : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
