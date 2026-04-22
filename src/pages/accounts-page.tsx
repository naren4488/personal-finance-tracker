import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CreditCard, Landmark, Users, Wallet } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AddAccountSheet } from "@/features/accounts/add-account-sheet"
import { AddCardSpendSheet } from "@/features/accounts/add-card-spend-sheet"
import { AddCreditCardSheet } from "@/features/accounts/add-credit-card-sheet"
import { AddLoanSheet } from "@/features/accounts/add-loan-sheet"
import { AddUdharEntrySheet } from "@/features/accounts/add-udhar-entry-sheet"
import { AdjustBalanceSheet } from "@/features/accounts/adjust-balance-sheet"
import { AccountCard, AccountCardSkeleton } from "@/features/accounts/account-card"
import {
  ACCOUNTS_SEGMENT_META,
  type AccountsSegmentId,
} from "@/features/accounts/accounts-mock-data"
import {
  ACCOUNTS_HIGHLIGHT_TX,
  ACCOUNTS_URL_ACCOUNT,
  ACCOUNTS_URL_CARD,
  ACCOUNTS_URL_LOAN,
  buildAccountsDetailPath,
} from "@/features/accounts/accounts-route"
import { CreditCardList } from "@/features/accounts/credit-card-list"
import { LoanList } from "@/features/accounts/loan-list"
import { PeopleList } from "@/features/accounts/people-list"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import {
  AddTransactionModal,
  type TransferPaymentPreset,
} from "@/features/entries/add-transaction-modal"
import type { Account } from "@/lib/api/account-schemas"
import { getAccountDeleteWarning } from "@/lib/accounts/account-delete"
import { accountSelectLabel, filterNormalAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { resolvePersonDeleteTarget } from "@/lib/people/person-delete"
import type { Person } from "@/lib/api/people-schemas"
import type { UdharEntryTypeScope } from "@/features/accounts/udhar-entry-form-model"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"
import { cn } from "@/lib/utils"
import {
  useGetAccountsQuery,
  useGetCreditCardsQuery,
  useGetLoansQuery,
  useDeleteAccountMutation,
  useDeletePersonMutation,
  useGetPeopleQuery,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

const SEGMENT_ORDER: AccountsSegmentId[] = ["accounts", "people", "loans", "cards"]

const SEGMENT_ICONS: Record<AccountsSegmentId, typeof Users> = {
  accounts: Wallet,
  people: Users,
  loans: Landmark,
  cards: CreditCard,
}

/** `<select>` value for People tab: list everyone with udhar across accounts (GET /people with no filter). */
const PEOPLE_ACCOUNT_ALL_VALUE = "__all_accounts__"

export default function AccountsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const loanQ = searchParams.get(ACCOUNTS_URL_LOAN)
  const cardQ = searchParams.get(ACCOUNTS_URL_CARD)
  const accountQ = searchParams.get(ACCOUNTS_URL_ACCOUNT)
  const transferSuccessSkipExitRef = useRef(false)
  const [segment, setSegment] = useState<AccountsSegmentId>("accounts")
  const [udharOpen, setUdharOpen] = useState(false)
  /** Prefill Add Udhar Entry when opened from a People row */
  const [udharPrefillPersonId, setUdharPrefillPersonId] = useState<string | null>(null)
  const [udharPrefillAccountId, setUdharPrefillAccountId] = useState<string | null>(null)
  const [udharEntryTypeScope, setUdharEntryTypeScope] = useState<UdharEntryTypeScope>("all")
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  /** User-picked account for People tab; falls back to first normal account when unset or stale. */
  const [peopleAccountPick, setPeopleAccountPick] = useState<string | null>(null)
  const [udharSheetPersonContext, setUdharSheetPersonContext] = useState<"from_people" | "free">(
    "free"
  )
  const [udharInitialEntryType, setUdharInitialEntryType] = useState<UdharEntryType | undefined>(
    undefined
  )
  /** Card list “Add spend” — sheet prefill. */
  const [cardForSpend, setCardForSpend] = useState<Account | null>(null)
  const [cardInlineSpendOpen, setCardInlineSpendOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPreset, setTransferPreset] = useState<TransferPaymentPreset | null>(null)
  const [pendingListDeleteAccount, setPendingListDeleteAccount] = useState<Account | null>(null)
  const [adjustBalanceAccount, setAdjustBalanceAccount] = useState<Account | null>(null)
  const [pendingDeletePerson, setPendingDeletePerson] = useState<Person | null>(null)
  const [isConfirmingPersonDelete, setIsConfirmingPersonDelete] = useState(false)
  const [deleteAccount, { isLoading: isDeletingFromList }] = useDeleteAccountMutation()
  const [deletePerson] = useDeletePersonMutation()
  const txDelete = useDeleteTransactionFlow()

  const openPayBillForCard = useCallback((a: Account) => {
    setTransferPreset({ kind: "credit_card_bill", creditCardAccountId: String(a.id) })
    setTransferModalOpen(true)
  }, [])

  const openPayEmiForLoan = useCallback((a: Account) => {
    setTransferPreset({ kind: "loan_emi", loanAccountId: String(a.id) })
    setTransferModalOpen(true)
  }, [])

  const openAddSpendForCard = useCallback((a: Account) => {
    setCardForSpend(a)
    setCardInlineSpendOpen(true)
  }, [])

  const confirmDeleteFromList = useCallback(async () => {
    if (!pendingListDeleteAccount) return
    const id = String(pendingListDeleteAccount.id ?? "").trim()
    if (!id) return
    try {
      const res = await deleteAccount(id).unwrap()
      toast.success(res.message ?? "Account deleted")
      setPendingListDeleteAccount(null)
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete")
    }
  }, [deleteAccount, pendingListDeleteAccount])

  const confirmDeletePerson = useCallback(async () => {
    if (!pendingDeletePerson) return
    setIsConfirmingPersonDelete(true)
    try {
      const target = resolvePersonDeleteTarget(pendingDeletePerson)
      if (target.mode === "account") {
        const res = await deleteAccount(target.id).unwrap()
        toast.success(res.message ?? "Deleted")
      } else {
        const res = await deletePerson(target.id).unwrap()
        toast.success(res.message ?? "Deleted")
      }
      setPendingDeletePerson(null)
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete")
    } finally {
      setIsConfirmingPersonDelete(false)
    }
  }, [deleteAccount, deletePerson, pendingDeletePerson])

  const meta = ACCOUNTS_SEGMENT_META[segment]
  const user = useAppSelector((s) => s.auth.user)

  const {
    data: apiAccounts,
    isLoading: accountsLoading,
    isError: accountsError,
    error: accountsQueryError,
    refetch: refetchAccounts,
  } = useGetAccountsQuery(undefined, { skip: !user })

  const {
    data: creditCards = [],
    isLoading: creditCardsLoading,
    isError: creditCardsError,
    error: creditCardsQueryError,
    refetch: refetchCreditCards,
  } = useGetCreditCardsQuery(undefined, { skip: !user || (segment !== "cards" && !cardQ) })

  const {
    data: loans = [],
    isLoading: loansLoading,
    isError: loansError,
    error: loansQueryError,
    refetch: refetchLoans,
  } = useGetLoansQuery(undefined, { skip: !user || (segment !== "loans" && !loanQ) })

  useEffect(() => {
    if (!creditCardsError || !creditCardsQueryError) return
    const msg = getErrorMessage(creditCardsQueryError)
    if (/authorization token is required/i.test(msg)) {
      toast.error("Session expired, please login again")
      navigate("/login", { replace: true })
    }
  }, [creditCardsError, creditCardsQueryError, navigate])

  useEffect(() => {
    if (!loansError || !loansQueryError) return
    const msg = getErrorMessage(loansQueryError)
    if (/authorization token is required/i.test(msg)) {
      toast.error("Session expired, please login again")
      navigate("/login", { replace: true })
    }
  }, [loansError, loansQueryError, navigate])

  /** Deep link: `/accounts?loan=` / `?card=` / `?account=` → correct tab before paint. */
  useLayoutEffect(() => {
    if (loanQ) setSegment("loans")
    else if (cardQ) setSegment("cards")
    else if (accountQ) setSegment("accounts")
  }, [loanQ, cardQ, accountQ])

  const normalAccounts = useMemo(() => filterNormalAccounts(apiAccounts ?? []), [apiAccounts])

  /** Legacy query detail links → `/accounts/:id`, `/loans/:id`, `/cards/:id`. */
  useEffect(() => {
    const loan = searchParams.get(ACCOUNTS_URL_LOAN)?.trim()
    const card = searchParams.get(ACCOUNTS_URL_CARD)?.trim()
    const acc = searchParams.get(ACCOUNTS_URL_ACCOUNT)?.trim()
    const highlight = searchParams.get(ACCOUNTS_HIGHLIGHT_TX)?.trim()
    if (loan) {
      navigate(`/loans/${encodeURIComponent(loan)}`, { replace: true })
      return
    }
    if (card) {
      navigate(`/cards/${encodeURIComponent(card)}`, { replace: true })
      return
    }
    if (acc) {
      const q = new URLSearchParams()
      if (highlight) q.set(ACCOUNTS_HIGHLIGHT_TX, highlight)
      const qs = q.toString()
      navigate(`/accounts/${encodeURIComponent(acc)}${qs ? `?${qs}` : ""}`, { replace: true })
    }
  }, [searchParams, navigate])

  const resolvedPeopleAccountFilter = useMemo(() => {
    if (normalAccounts.length === 0) return ""
    if (peopleAccountPick === PEOPLE_ACCOUNT_ALL_VALUE) return PEOPLE_ACCOUNT_ALL_VALUE
    if (peopleAccountPick && normalAccounts.some((a) => String(a.id) === peopleAccountPick)) {
      return peopleAccountPick
    }
    return String(normalAccounts[0].id)
  }, [normalAccounts, peopleAccountPick])

  useEffect(() => {
    const seg = (location.state as { accountsSegment?: AccountsSegmentId } | undefined)
      ?.accountsSegment
    if (!seg || !SEGMENT_ORDER.includes(seg)) return
    setSegment(seg)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
  }, [location.pathname, location.search, location.state, navigate])

  const navigateToPersonView = useCallback(
    (person: Person) => {
      const q =
        resolvedPeopleAccountFilter !== PEOPLE_ACCOUNT_ALL_VALUE
          ? `?accountId=${encodeURIComponent(resolvedPeopleAccountFilter)}`
          : ""
      navigate(`/people/${encodeURIComponent(String(person.id))}${q}`)
    },
    [navigate, resolvedPeopleAccountFilter]
  )

  const openPeopleUdharSheet = useCallback(() => {
    setUdharPrefillPersonId(null)
    setUdharPrefillAccountId(
      resolvedPeopleAccountFilter === PEOPLE_ACCOUNT_ALL_VALUE ? "" : resolvedPeopleAccountFilter
    )
    setUdharSheetPersonContext("free")
    setUdharInitialEntryType(undefined)
    setUdharEntryTypeScope("all")
    setUdharOpen(true)
  }, [resolvedPeopleAccountFilter])

  const handleUdharSheetOpenChange = useCallback((open: boolean) => {
    setUdharOpen(open)
    if (!open) {
      setUdharPrefillPersonId(null)
      setUdharPrefillAccountId(null)
      setUdharSheetPersonContext("free")
      setUdharInitialEntryType(undefined)
      setUdharEntryTypeScope("all")
    }
  }, [])

  const peopleQuerySkip = !user || segment !== "people" || normalAccounts.length === 0

  const {
    data: peopleForAccount = [],
    isLoading: peopleQueryLoading,
    isFetching: peopleQueryFetching,
    isError: peopleListError,
    error: peopleQueryError,
    refetch: refetchPeople,
  } = useGetPeopleQuery(
    resolvedPeopleAccountFilter === PEOPLE_ACCOUNT_ALL_VALUE
      ? {}
      : { accountId: resolvedPeopleAccountFilter },
    { skip: peopleQuerySkip }
  )

  const peopleForList = useMemo(() => {
    if (resolvedPeopleAccountFilter !== PEOPLE_ACCOUNT_ALL_VALUE) return peopleForAccount
    const seen = new Set<string>()
    return peopleForAccount.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [peopleForAccount, resolvedPeopleAccountFilter])

  const showPeopleLoading =
    segment === "people" && normalAccounts.length > 0 && (peopleQueryLoading || peopleQueryFetching)

  const peopleEmptySubtext =
    resolvedPeopleAccountFilter === PEOPLE_ACCOUNT_ALL_VALUE
      ? "Add someone or record udhar on any account to see them here."
      : undefined

  /** Prefer latest row from GET /accounts cache (updated after transactions) over the object captured at click time. */
  const resolveAccountFromCache = useCallback(
    (current: Account | null): Account | null => {
      if (!current) return null
      const id = String(current.id)
      const fromApi = apiAccounts?.find((a) => String(a.id) === id)
      return fromApi ?? current
    },
    [apiAccounts]
  )

  const resolvedAdjustBalanceAccount = useMemo(
    () => resolveAccountFromCache(adjustBalanceAccount),
    [resolveAccountFromCache, adjustBalanceAccount]
  )

  const showAccountsLoading = segment === "accounts" && accountsLoading
  const showAccountsError = segment === "accounts" && accountsError
  const showAccountsEmpty =
    segment === "accounts" &&
    !showAccountsLoading &&
    !showAccountsError &&
    normalAccounts.length === 0

  function openHeaderAdd() {
    if (segment === "accounts") setAddAccountOpen(true)
    else if (segment === "people") openPeopleUdharSheet()
    else if (segment === "loans") setLoanOpen(true)
    else if (segment === "cards") setCardOpen(true)
    else {
      setUdharPrefillPersonId(null)
      setUdharPrefillAccountId(null)
      setUdharSheetPersonContext("free")
      setUdharInitialEntryType(undefined)
      setUdharEntryTypeScope("all")
      setUdharOpen(true)
    }
  }

  const headerAddAriaLabel: Record<AccountsSegmentId, string> = {
    accounts: "Add account",
    people: "Add udhar entry",
    loans: "Add loan",
    cards: "Add credit card",
  }

  const showLoansLoading = segment === "loans" && loansLoading
  const showLoansError = segment === "loans" && loansError
  const showLoansEmpty = segment === "loans" && !loansLoading && !loansError && loans.length === 0
  const showCardsEmpty =
    segment === "cards" && !creditCardsLoading && !creditCardsError && creditCards.length === 0

  const showHeaderAdd =
    (segment === "accounts" &&
      !showAccountsLoading &&
      !showAccountsError &&
      normalAccounts.length > 0) ||
    (segment === "people" && normalAccounts.length > 0 && !peopleListError) ||
    (segment === "loans" && !loansLoading && !loansError && loans.length > 0) ||
    (segment === "cards" && !creditCardsLoading && !creditCardsError && creditCards.length > 0)

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 pb-28 pt-4">
      <ConfirmDeleteDialog
        open={!!pendingListDeleteAccount}
        onOpenChange={(v) => {
          if (!v) setPendingListDeleteAccount(null)
        }}
        title="Delete account"
        warning={
          pendingListDeleteAccount ? getAccountDeleteWarning(pendingListDeleteAccount) : null
        }
        isDeleting={isDeletingFromList}
        onConfirm={confirmDeleteFromList}
      />
      <ConfirmDeleteDialog
        open={!!pendingDeletePerson}
        onOpenChange={(v) => {
          if (!v) setPendingDeletePerson(null)
        }}
        title="Delete"
        isDeleting={isConfirmingPersonDelete}
        onConfirm={confirmDeletePerson}
      />
      <ConfirmDeleteDialog
        open={txDelete.confirmOpen}
        onOpenChange={(v) => !v && txDelete.dismiss()}
        title="Delete entry"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        isDeleting={txDelete.isDeleting}
        onConfirm={txDelete.confirmDelete}
      />
      <AdjustBalanceSheet
        open={!!adjustBalanceAccount}
        onOpenChange={(v) => {
          if (!v) setAdjustBalanceAccount(null)
        }}
        account={resolvedAdjustBalanceAccount}
      />
      <AddAccountSheet open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <AddUdharEntrySheet
        open={udharOpen}
        onOpenChange={handleUdharSheetOpenChange}
        initialPersonId={udharPrefillPersonId ?? undefined}
        initialAccountId={udharPrefillAccountId ?? undefined}
        personContext={udharSheetPersonContext}
        initialEntryType={udharInitialEntryType}
        entryTypeScope={udharEntryTypeScope}
      />
      <AddLoanSheet open={loanOpen} onOpenChange={setLoanOpen} />
      <AddCreditCardSheet open={cardOpen} onOpenChange={setCardOpen} />
      <AddCardSpendSheet
        open={cardInlineSpendOpen && !!cardForSpend}
        onOpenChange={(v) => {
          setCardInlineSpendOpen(v)
          if (!v) setCardForSpend(null)
        }}
        account={cardForSpend}
      />
      <AddTransactionModal
        open={transferModalOpen}
        onOpenChange={(v) => {
          setTransferModalOpen(v)
          if (!v) {
            transferSuccessSkipExitRef.current = false
            setTransferPreset(null)
          }
        }}
        initialType="transfer"
        transferPaymentPreset={transferPreset}
        accountsReturnPath="/accounts"
        successNavigateTo={
          transferPreset?.kind === "loan_emi"
            ? buildAccountsDetailPath({ kind: "loan", id: transferPreset.loanAccountId })
            : transferPreset?.kind === "credit_card_bill"
              ? buildAccountsDetailPath({
                  kind: "card",
                  id: transferPreset.creditCardAccountId,
                })
              : null
        }
        onTransactionSuccess={() => {
          transferSuccessSkipExitRef.current = true
        }}
      />
      <div
        className="mb-3 grid shrink-0 grid-cols-4 gap-1 sm:mb-4"
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
                "flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold transition-colors sm:min-h-11 sm:flex-row sm:gap-1 sm:px-2 sm:text-xs",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => {
                setCardInlineSpendOpen(false)
                setCardForSpend(null)
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev)
                    if (id === "loans") {
                      p.delete(ACCOUNTS_URL_CARD)
                      p.delete(ACCOUNTS_URL_ACCOUNT)
                      p.delete(ACCOUNTS_HIGHLIGHT_TX)
                    } else if (id === "cards") {
                      p.delete(ACCOUNTS_URL_LOAN)
                      p.delete(ACCOUNTS_URL_ACCOUNT)
                      p.delete(ACCOUNTS_HIGHLIGHT_TX)
                    } else if (id === "accounts") {
                      p.delete(ACCOUNTS_URL_LOAN)
                      p.delete(ACCOUNTS_URL_CARD)
                    } else {
                      p.delete(ACCOUNTS_URL_LOAN)
                      p.delete(ACCOUNTS_URL_CARD)
                      p.delete(ACCOUNTS_URL_ACCOUNT)
                      p.delete(ACCOUNTS_HIGHLIGHT_TX)
                    }
                    return p
                  },
                  { replace: true }
                )
                setSegment(id)
              }}
            >
              <Icon
                className="size-3.5 shrink-0 sm:size-4"
                strokeWidth={active ? 2.25 : 1.75}
                aria-hidden
              />
              <span className="leading-none">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex min-h-[2.75rem] shrink-0 items-center justify-between gap-3">
          <h1
            className={cn(
              "min-w-0 flex-1 text-lg font-bold leading-tight tracking-tight",
              segment === "loans" || segment === "cards" ? "text-primary" : "text-foreground"
            )}
          >
            {meta.listTitle}
          </h1>
          <div className="flex h-9 min-w-[3.25rem] shrink-0 items-center justify-end">
            {showHeaderAdd ? (
              <Button
                type="button"
                variant="link"
                className="h-9 shrink-0 px-0 text-sm font-semibold text-primary"
                onClick={openHeaderAdd}
                aria-label={headerAddAriaLabel[segment]}
              >
                {segment === "people" ? "+ Add" : "+ Add"}
              </Button>
            ) : (
              <span className="inline-block h-9 w-[3.25rem] shrink-0" aria-hidden />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]">
          {showAccountsLoading ? (
            <div className="flex flex-col gap-3">
              <AccountCardSkeleton />
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </div>
          ) : showAccountsError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-destructive">{getErrorMessage(accountsQueryError)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => refetchAccounts()}
              >
                Retry
              </Button>
            </div>
          ) : showAccountsEmpty ? (
            <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
              <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
                  <Landmark className="size-7 text-primary" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-base font-bold text-primary">No accounts</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add your bank accounts and wallets
                </p>
                <Button
                  type="button"
                  className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
                  onClick={() => setAddAccountOpen(true)}
                >
                  Add Account
                </Button>
              </CardContent>
            </Card>
          ) : segment === "people" && accountsLoading ? (
            <PeopleList
              people={[]}
              loading
              error={null}
              onRetry={() => void refetchAccounts()}
              onAddClick={openPeopleUdharSheet}
              onPersonClick={() => {}}
            />
          ) : segment === "people" && accountsError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-destructive">{getErrorMessage(accountsQueryError)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void refetchAccounts()}
              >
                Retry
              </Button>
            </div>
          ) : segment === "people" && normalAccounts.length === 0 ? (
            <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
              <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
                  <Users className="size-7 text-primary" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-base font-bold text-primary">No accounts for people</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add a bank account or wallet to list people linked to it.
                </p>
                <Button
                  type="button"
                  className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
                  onClick={() => setAddAccountOpen(true)}
                >
                  Add Account
                </Button>
              </CardContent>
            </Card>
          ) : segment === "people" ? (
            <div className="space-y-3">
              {normalAccounts.length > 0 ? (
                <div className="space-y-1">
                  <Label htmlFor="people-account-filter" className="text-xs font-bold text-primary">
                    Account
                  </Label>
                  <select
                    id="people-account-filter"
                    value={resolvedPeopleAccountFilter}
                    onChange={(e) => setPeopleAccountPick(e.target.value)}
                    className={cn(
                      "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    )}
                  >
                    <option value={PEOPLE_ACCOUNT_ALL_VALUE}>All accounts</option>
                    {normalAccounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {accountSelectLabel(a)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <PeopleList
                people={peopleForList}
                loading={showPeopleLoading && !peopleListError}
                error={peopleListError ? peopleQueryError : null}
                onRetry={() => void refetchPeople()}
                onAddClick={openPeopleUdharSheet}
                onPersonClick={navigateToPersonView}
                onPersonDelete={(p) => setPendingDeletePerson(p)}
                emptyStateSubtext={peopleEmptySubtext}
              />
            </div>
          ) : segment === "cards" && creditCardsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-18 w-full rounded-2xl" />
              <Skeleton className="h-18 w-full rounded-2xl" />
            </div>
          ) : segment === "cards" && creditCardsError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-destructive">{getErrorMessage(creditCardsQueryError)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => refetchCreditCards()}
              >
                Retry
              </Button>
            </div>
          ) : showLoansLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-18 w-full rounded-2xl" />
              <Skeleton className="h-18 w-full rounded-2xl" />
            </div>
          ) : showLoansError ? (
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm text-destructive">{getErrorMessage(loansQueryError)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => refetchLoans()}
              >
                Retry
              </Button>
            </div>
          ) : showLoansEmpty ? (
            <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
              <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
                  <Landmark className="size-7 text-primary" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-base font-bold text-primary">No loans found</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add a loan to track EMIs
                </p>
                <Button
                  type="button"
                  className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
                  onClick={() => setLoanOpen(true)}
                >
                  Add Loan
                </Button>
              </CardContent>
            </Card>
          ) : showCardsEmpty ? (
            <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
              <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
                  <CreditCard className="size-7 text-primary" strokeWidth={2} aria-hidden />
                </div>
                <p className="text-base font-bold text-primary">No credit cards</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add your credit card to track spending
                </p>
                <Button
                  type="button"
                  className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
                  onClick={() => setCardOpen(true)}
                >
                  Add Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {segment === "cards" ? (
                <CreditCardList
                  accounts={creditCards}
                  variant="entries"
                  onSelectCard={(a) => {
                    navigate(`/cards/${encodeURIComponent(String(a.id))}`)
                  }}
                  onAddSpend={openAddSpendForCard}
                  onPayBill={openPayBillForCard}
                />
              ) : segment === "loans" ? (
                <LoanList
                  accounts={loans}
                  variant="entries"
                  onSelectLoan={(a) => {
                    navigate(`/loans/${encodeURIComponent(String(a.id))}`)
                  }}
                  onPayEmi={openPayEmiForLoan}
                />
              ) : (
                <ul
                  className="flex list-none flex-col gap-2.5"
                  aria-label={`${meta.listTitle} list`}
                >
                  {normalAccounts.map((a) => (
                    <li key={a.id}>
                      <AccountCard
                        account={a}
                        onOpen={() => {
                          navigate(`/accounts/${encodeURIComponent(String(a.id))}`)
                        }}
                        onEdit={() => {
                          navigate(`/accounts/${encodeURIComponent(String(a.id))}`, {
                            state: { initialEditing: true },
                          })
                        }}
                        onAdjust={() => setAdjustBalanceAccount(a)}
                        onDelete={() => setPendingListDeleteAccount(a)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
