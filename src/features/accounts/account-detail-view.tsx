import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ArrowLeft, Banknote, Check, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAccountDeleteWarning } from "@/lib/accounts/account-delete"
import type { Account } from "@/lib/api/account-schemas"
import {
  accountAvailableBalanceInrFromApi,
  accountBalanceInrFromApi,
  accountSubtitleForList,
  formatOpeningBalanceForApi,
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

export function AccountDetailView({
  open,
  onOpenChange,
  account,
  onAccountUpdated,
  initialEditing = false,
  onAccountDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  onAccountUpdated?: (account: Account) => void
  /** Set when opening from list card "Edit" (use a distinct `key` on the parent so state remounts). */
  initialEditing?: boolean
  /** Called after successful DELETE /accounts/:id so parent can clear selection. */
  onAccountDeleted?: () => void
}) {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [updateAccount, { isLoading: isSaving }] = useUpdateAccountMutation()
  const [deleteAccount, { isLoading: isDeletingAccount }] = useDeleteAccountMutation()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const txDelete = useDeleteTransactionFlow()
  const [isEditing, setIsEditing] = useState(initialEditing)
  const [draftName, setDraftName] = useState(() => account?.name?.trim() ?? "")

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
    setDraftName("")
    onOpenChange(false)
  }, [onOpenChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraftName("")
  }, [])

  const startEdit = useCallback(() => {
    if (!account) return
    setDraftName(account.name?.trim() ?? "")
    setIsEditing(true)
  }, [account])

  const saveEdit = useCallback(async () => {
    if (!account) return
    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Unable to update account: missing id")
      return
    }
    const name = draftName.trim()
    if (!name) {
      toast.error("Enter account name")
      return
    }

    const openingInr = openingBalanceInrFromApi(account)
    const isActive = account.isActive !== false

    const payload: Record<string, unknown> = {
      name,
      openingBalance: formatOpeningBalanceForApi(openingInr),
      isActive,
    }

    try {
      console.log("Updating account payload:", payload)
      const response = await updateAccount({ id: accountId, body: payload }).unwrap()
      console.log("Updated account response:", response)
      const next = (response.account as Account | undefined) ?? {
        ...account,
        name,
        openingBalance: formatOpeningBalanceForApi(openingInr),
        isActive,
      }
      onAccountUpdated?.(next)
      toast.success(response.message ?? "Account updated")
      setIsEditing(false)
      setDraftName("")
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
  }, [account, draftName, navigate, onAccountUpdated, updateAccount])

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
      setDraftName("")
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

  if (!open || !account) return null

  const workingName = isEditing ? draftName : account.name
  const subtitle = accountSubtitleForList(account)
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
                {!isEditing ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        id="account-detail-name"
                        className="truncate text-xl font-bold tracking-tight sm:text-2xl"
                      >
                        {workingName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-9 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15"
                        aria-label="Edit account"
                        onClick={startEdit}
                      >
                        <Pencil className="size-[18px]" strokeWidth={2} aria-hidden />
                      </Button>
                      <span className="flex size-9 items-center justify-center" aria-hidden>
                        <Banknote className="size-6 text-primary-foreground/95" strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="account-detail-name"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border-0 bg-background px-3 py-2 text-base font-semibold text-foreground shadow-sm"
                      placeholder="Account name"
                      autoComplete="off"
                      aria-label="Account name"
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      className="size-10 shrink-0 rounded-full"
                      disabled={isSaving}
                      onClick={() => void saveEdit()}
                      aria-label="Save"
                    >
                      <Check className="size-5 text-income" strokeWidth={2} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="secondary"
                      className="size-10 shrink-0 rounded-full"
                      disabled={isSaving}
                      onClick={cancelEdit}
                      aria-label="Cancel"
                    >
                      <X className="size-5" strokeWidth={2} aria-hidden />
                    </Button>
                  </div>
                )}

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
                onClick={() => comingSoon("Add transaction")}
              >
                Add Transaction
              </Button>

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
                  {accountTxs.map((tx) => (
                    <li key={tx.id}>
                      <RecentTransactionRow
                        tx={tx}
                        accounts={accountsForRows}
                        onDelete={txDelete.requestDelete}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
