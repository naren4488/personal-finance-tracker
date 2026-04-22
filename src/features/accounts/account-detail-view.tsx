import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ArrowLeft, Banknote, Pencil, Scale, Trash2 } from "lucide-react"
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
import {
  TX_FORM_DESCRIPTION_CLASS,
  TX_FORM_FIELDS_STACK_CLASS,
  TX_FORM_FIELD_CLASS,
  TX_FORM_FOOTER_CLASS,
  TX_FORM_HEADER_CLASS,
  TX_FORM_LABEL_CLASS,
  TX_FORM_PANEL_CLASS,
  TX_FORM_SECONDARY_BTN_CLASS,
  TX_FORM_SUBMIT_CLASS,
  TX_FORM_SWITCH_ROW_CLASS,
  TX_FORM_TITLE_CLASS,
} from "@/lib/ui/tx-modal-form-classes"
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
  onBack,
  account,
  onAccountUpdated,
  initialEditing = false,
  onAccountDeleted,
  onAdjustBalance,
  highlightTransactionId,
  onHighlightTransactionConsumed,
}: {
  onBack: () => void
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
    skip: !user || !account,
  })

  const { data: recentTransactions = [] } = useGetRecentTransactionsQuery(
    { limit: 5000 },
    {
      skip: !account,
    }
  )

  const dismiss = useCallback(() => {
    setDeleteConfirmOpen(false)
    setIsEditing(false)
    setDraft(null)
    onBack()
  }, [onBack])

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
    if (!account) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (isEditing) cancelEdit()
      else dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [account, isEditing, cancelEdit, dismiss])

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
      onBack()
      onAccountDeleted?.()
    } catch (error) {
      const msg = getErrorMessage(error)
      toast.error(msg || "Failed to delete")
    }
  }, [account, deleteAccount, onAccountDeleted, onBack])

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
    if (!account || !highlightTransactionId?.trim()) return
    const id = highlightTransactionId.trim()
    const el = document.getElementById(`account-tx-${id}`)
    if (!el) return
    el.scrollIntoView({ block: "nearest", behavior: "smooth" })
    const t = window.setTimeout(() => onHighlightTransactionConsumed?.(), 2200)
    return () => window.clearTimeout(t)
  }, [account, highlightTransactionId, accountTxs, onHighlightTransactionConsumed])

  if (!account) return null

  const headerTitle = isEditing && draft ? draft.name.trim() || account.name : account.name
  const subtitle = accountSubtitleForList(account)

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
      <main
        className="flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden bg-background"
        aria-labelledby="account-detail-name"
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
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-24 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-5 sm:pb-10"
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
            <div className={TX_FORM_PANEL_CLASS}>
              <header className={TX_FORM_HEADER_CLASS}>
                <h2 className={TX_FORM_TITLE_CLASS}>Edit Account</h2>
                <p className={TX_FORM_DESCRIPTION_CLASS}>
                  Update name, institution, and active status. Balance changes: use Adjust balance.
                </p>
              </header>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-width:thin]",
                  TX_FORM_FIELDS_STACK_CLASS
                )}
              >
                <section>
                  <Label htmlFor="account-edit-name" className={TX_FORM_LABEL_CLASS}>
                    Name
                  </Label>
                  <Input
                    id="account-edit-name"
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className={TX_FORM_FIELD_CLASS}
                    placeholder="e.g. SBI Savings"
                    autoComplete="off"
                    aria-labelledby="account-detail-name"
                  />
                </section>

                <section>
                  <Label htmlFor="account-edit-bank" className={TX_FORM_LABEL_CLASS}>
                    Bank / institution
                  </Label>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Optional on save when empty. Same field spacing as Add Transaction.
                  </p>
                  <Input
                    id="account-edit-bank"
                    value={draft.bankName}
                    onChange={(e) => patchDraft({ bankName: e.target.value })}
                    className={TX_FORM_FIELD_CLASS}
                    placeholder="e.g. SBI, HDFC"
                    autoComplete="organization"
                  />
                </section>

                <section className={TX_FORM_SWITCH_ROW_CLASS}>
                  <div className="min-w-0 space-y-0.5">
                    <Label
                      htmlFor="account-edit-active"
                      className="text-xs font-bold text-foreground sm:text-sm"
                    >
                      Active account
                    </Label>
                    <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                      Inactive accounts stay hidden from most flows
                    </p>
                  </div>
                  <Switch
                    id="account-edit-active"
                    checked={draft.isActive}
                    onCheckedChange={(v) => patchDraft({ isActive: v })}
                    aria-label="Account active"
                    className="shrink-0"
                  />
                </section>
              </div>

              <footer className={TX_FORM_FOOTER_CLASS}>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(TX_FORM_SECONDARY_BTN_CLASS, "sm:w-36 sm:shrink-0")}
                    onClick={cancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className={cn(TX_FORM_SUBMIT_CLASS, "sm:flex-1")}
                    onClick={() => void saveEdit()}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </footer>
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
      </main>
    </>
  )
}
