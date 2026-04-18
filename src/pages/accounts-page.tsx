import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
import { AccountDetailView } from "@/features/accounts/account-detail-view"
import {
  ACCOUNTS_SEGMENT_META,
  type AccountsSegmentId,
} from "@/features/accounts/accounts-mock-data"
import {
  ACCOUNTS_URL_CARD,
  ACCOUNTS_URL_LOAN,
  applyAccountsDetailSearch,
} from "@/features/accounts/accounts-route"
import { CreditCardDetailView } from "@/features/accounts/credit-card-detail-view"
import { CreditCardList } from "@/features/accounts/credit-card-list"
import { LoanDetailView } from "@/features/accounts/loan-detail-view"
import { LoanList } from "@/features/accounts/loan-list"
import { PeopleList } from "@/features/accounts/people-list"
import {
  readPersonLedgerCache,
  usePeopleLedgerBalances,
} from "@/features/accounts/use-people-ledger-balances"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import { UdharDetailsModal } from "@/features/accounts/udhar-details-modal"
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
import type { UdharAccountPersonBalance } from "@/lib/api/udhar-summary-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { cn } from "@/lib/utils"
import {
  useGetAccountsQuery,
  useGetCreditCardsQuery,
  useGetLoansQuery,
  useDeleteAccountMutation,
  useDeletePersonMutation,
  useGetPeopleQuery,
  useLazyGetPersonLedgerQuery,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

const SEGMENT_ORDER: AccountsSegmentId[] = ["accounts", "people", "loans", "cards"]

const SEGMENT_ICONS: Record<AccountsSegmentId, typeof Users> = {
  accounts: Wallet,
  people: Users,
  loans: Landmark,
  cards: CreditCard,
}

const EMPTY_LEDGER_BALANCE_MAP = new Map<string, UdharAccountPersonBalance>()
const EMPTY_PENDING_IDS = new Set<string>()
const EMPTY_LEDGER_ERR_MAP = new Map<string, string>()

export default function AccountsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const loanQ = searchParams.get(ACCOUNTS_URL_LOAN)
  const cardQ = searchParams.get(ACCOUNTS_URL_CARD)
  const prevDetailLoanRef = useRef<string | null>(null)
  const prevDetailCardRef = useRef<string | null>(null)
  const [segment, setSegment] = useState<AccountsSegmentId>("accounts")
  const [udharOpen, setUdharOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  /** User-picked account for People tab; falls back to first normal account when unset or stale. */
  const [peopleAccountPick, setPeopleAccountPick] = useState<string | null>(null)
  const [udharLedgerOpen, setUdharLedgerOpen] = useState(false)
  const [udharLedgerName, setUdharLedgerName] = useState("")
  const [udharLedgerEntries, setUdharLedgerEntries] = useState<RecentTransaction[]>([])
  const [selectedCreditCard, setSelectedCreditCard] = useState<Account | null>(null)
  const [selectedLoan, setSelectedLoan] = useState<Account | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  /** Full-screen loan detail — only when user opens a loan from the list (or URL deep link). */
  const [loanDetailVisible, setLoanDetailVisible] = useState(false)
  /** Full-screen card detail — only when user opens a card from the list (or URL deep link). */
  const [cardDetailVisible, setCardDetailVisible] = useState(false)
  /** Add spend sheet (single instance on this page; list or after leaving card detail). */
  const [cardInlineSpendOpen, setCardInlineSpendOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPreset, setTransferPreset] = useState<TransferPaymentPreset | null>(null)
  const [accountDetailStartInEdit, setAccountDetailStartInEdit] = useState(false)
  const [accountDetailOpenNonce, setAccountDetailOpenNonce] = useState(0)
  const [pendingListDeleteAccount, setPendingListDeleteAccount] = useState<Account | null>(null)
  const [adjustBalanceAccount, setAdjustBalanceAccount] = useState<Account | null>(null)
  const [pendingDeletePerson, setPendingDeletePerson] = useState<Person | null>(null)
  const [isConfirmingPersonDelete, setIsConfirmingPersonDelete] = useState(false)
  const [deleteAccount, { isLoading: isDeletingFromList }] = useDeleteAccountMutation()
  const [deletePerson] = useDeletePersonMutation()
  const txDelete = useDeleteTransactionFlow()

  const openPayBillFromCardDetail = useCallback(() => {
    const a = selectedCreditCard
    if (!a) return
    setTransferPreset({ kind: "credit_card_bill", creditCardAccountId: String(a.id) })
    setTransferModalOpen(true)
  }, [selectedCreditCard])

  const openPayEmiFromLoanDetail = useCallback(() => {
    const a = selectedLoan
    if (!a) return
    setTransferPreset({ kind: "loan_emi", loanAccountId: String(a.id) })
    setTransferModalOpen(true)
  }, [selectedLoan])

  const exitToLoansList = useCallback(() => {
    setSegment("loans")
    setLoanDetailVisible(false)
    setSelectedLoan(null)
    applyAccountsDetailSearch(setSearchParams, null)
  }, [setSearchParams])

  const exitToCardsList = useCallback(() => {
    setSegment("cards")
    setCardDetailVisible(false)
    setCardInlineSpendOpen(false)
    setSelectedCreditCard(null)
    applyAccountsDetailSearch(setSearchParams, null)
  }, [setSearchParams])

  const openAddSpendFromCardDetail = useCallback(() => {
    if (!selectedCreditCard) return
    setCardDetailVisible(false)
    applyAccountsDetailSearch(setSearchParams, null)
    setCardInlineSpendOpen(true)
  }, [selectedCreditCard, setSearchParams])

  const confirmDeleteFromList = useCallback(async () => {
    if (!pendingListDeleteAccount) return
    const id = String(pendingListDeleteAccount.id ?? "").trim()
    if (!id) return
    try {
      const res = await deleteAccount(id).unwrap()
      toast.success(res.message ?? "Account deleted")
      setPendingListDeleteAccount(null)
      if (selectedAccount && String(selectedAccount.id) === id) {
        setSelectedAccount(null)
        setAccountDetailStartInEdit(false)
      }
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete")
    }
  }, [deleteAccount, pendingListDeleteAccount, selectedAccount])

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
    isFetching: creditCardsFetching,
    isError: creditCardsError,
    error: creditCardsQueryError,
    refetch: refetchCreditCards,
  } = useGetCreditCardsQuery(undefined, { skip: !user || (segment !== "cards" && !cardQ) })

  const {
    data: loans = [],
    isLoading: loansLoading,
    isFetching: loansFetching,
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

  /** Deep link: `/accounts?loan=` / `?card=` → correct tab before paint. */
  useLayoutEffect(() => {
    if (loanQ) setSegment("loans")
    else if (cardQ) setSegment("cards")
  }, [loanQ, cardQ])

  /** Keep loan/card detail selection aligned with URL (back/forward, bookmarks, invalid id cleanup). */
  useEffect(() => {
    if (loanQ) {
      prevDetailLoanRef.current = loanQ
      prevDetailCardRef.current = null
      if (loansLoading || loansFetching) return
      const acc = loans.find((a) => String(a.id) === loanQ)
      if (acc) {
        setSelectedLoan((prev) => (prev && String(prev.id) === loanQ ? prev : acc))
        setLoanDetailVisible(true)
      } else {
        setSelectedLoan(null)
        setLoanDetailVisible(false)
        applyAccountsDetailSearch(setSearchParams, null)
      }
      return
    }
    if (cardQ) {
      prevDetailCardRef.current = cardQ
      prevDetailLoanRef.current = null
      if (creditCardsLoading || creditCardsFetching) return
      const acc = creditCards.find((a) => String(a.id) === cardQ)
      if (acc) {
        setSelectedCreditCard((prev) => (prev && String(prev.id) === cardQ ? prev : acc))
        setCardDetailVisible(true)
      } else {
        setSelectedCreditCard(null)
        setCardDetailVisible(false)
        applyAccountsDetailSearch(setSearchParams, null)
      }
      return
    }
    const hadDetailInUrl = prevDetailLoanRef.current || prevDetailCardRef.current
    prevDetailLoanRef.current = null
    prevDetailCardRef.current = null
    if (hadDetailInUrl) {
      setSelectedLoan(null)
      setSelectedCreditCard(null)
      setLoanDetailVisible(false)
      setCardDetailVisible(false)
      setCardInlineSpendOpen(false)
    }
  }, [
    loanQ,
    cardQ,
    loans,
    creditCards,
    loansLoading,
    loansFetching,
    creditCardsLoading,
    creditCardsFetching,
    setSearchParams,
  ])

  const normalAccounts = useMemo(() => filterNormalAccounts(apiAccounts ?? []), [apiAccounts])

  const peopleAccountId = useMemo(() => {
    if (normalAccounts.length === 0) return ""
    if (peopleAccountPick && normalAccounts.some((a) => String(a.id) === peopleAccountPick)) {
      return peopleAccountPick
    }
    return String(normalAccounts[0].id)
  }, [normalAccounts, peopleAccountPick])

  const [fetchPersonLedger] = useLazyGetPersonLedgerQuery()

  const onPersonClickLedger = useCallback(
    async (person: Person) => {
      try {
        const cached = readPersonLedgerCache(person.id)
        const entries =
          cached ?? (await fetchPersonLedger({ personId: person.id, limit: 500 }).unwrap())
        setUdharLedgerName(person.name)
        setUdharLedgerEntries(entries)
        setUdharLedgerOpen(true)
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    },
    [fetchPersonLedger]
  )

  const peopleQuerySkip = !user || segment !== "people" || !peopleAccountId

  const {
    data: peopleForAccount = [],
    fulfilledTimeStamp: peopleListFulfilledAt,
    isLoading: peopleQueryLoading,
    isFetching: peopleQueryFetching,
    isError: peopleListError,
    error: peopleQueryError,
    refetch: refetchPeople,
  } = useGetPeopleQuery({ accountId: peopleAccountId }, { skip: peopleQuerySkip })

  const {
    balanceByPersonId: ledgerBalanceByPersonId,
    balanceErrorByPersonId,
    pendingPersonIds: ledgerPendingPersonIds,
  } = usePeopleLedgerBalances(peopleForAccount, !peopleQuerySkip, 2, peopleListFulfilledAt)

  const showPeopleLoading =
    segment === "people" &&
    normalAccounts.length > 0 &&
    (!peopleAccountId || peopleQueryLoading || peopleQueryFetching)

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

  const resolvedSelectedAccount = useMemo(
    () => resolveAccountFromCache(selectedAccount),
    [resolveAccountFromCache, selectedAccount]
  )
  const resolvedAdjustBalanceAccount = useMemo(
    () => resolveAccountFromCache(adjustBalanceAccount),
    [resolveAccountFromCache, adjustBalanceAccount]
  )
  const resolvedSelectedCreditCard = useMemo(
    () => resolveAccountFromCache(selectedCreditCard),
    [resolveAccountFromCache, selectedCreditCard]
  )
  const resolvedSelectedLoan = useMemo(
    () => resolveAccountFromCache(selectedLoan),
    [resolveAccountFromCache, selectedLoan]
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
    else if (segment === "people") setUdharOpen(true)
    else if (segment === "loans") setLoanOpen(true)
    else if (segment === "cards") setCardOpen(true)
    else setUdharOpen(true)
  }

  const headerAddAriaLabel: Record<AccountsSegmentId, string> = {
    accounts: "Add account",
    people: "Add person",
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
      <AddUdharEntrySheet open={udharOpen} onOpenChange={setUdharOpen} />
      <AddLoanSheet open={loanOpen} onOpenChange={setLoanOpen} />
      <AddCreditCardSheet open={cardOpen} onOpenChange={setCardOpen} />
      <AddCardSpendSheet
        open={cardInlineSpendOpen && !!selectedCreditCard}
        onOpenChange={(v) => {
          setCardInlineSpendOpen(v)
          if (!v) exitToCardsList()
        }}
        account={resolvedSelectedCreditCard}
      />
      <CreditCardDetailView
        open={!!selectedCreditCard && cardDetailVisible}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedCreditCard(null)
            setCardDetailVisible(false)
            applyAccountsDetailSearch(setSearchParams, null)
          }
        }}
        account={resolvedSelectedCreditCard}
        onCardUpdated={(a) => setSelectedCreditCard(a)}
        onPayBill={openPayBillFromCardDetail}
        onAddSpend={openAddSpendFromCardDetail}
        onCardDeleted={() => {
          setSelectedCreditCard(null)
          setCardDetailVisible(false)
        }}
      />
      <LoanDetailView
        open={!!selectedLoan && loanDetailVisible}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedLoan(null)
            setLoanDetailVisible(false)
            applyAccountsDetailSearch(setSearchParams, null)
          }
        }}
        account={resolvedSelectedLoan}
        onLoanUpdated={(a) => setSelectedLoan(a)}
        onPayEmi={openPayEmiFromLoanDetail}
        onLoanDeleted={() => {
          setSelectedLoan(null)
          setLoanDetailVisible(false)
        }}
      />
      <AddTransactionModal
        open={transferModalOpen}
        onOpenChange={(v) => {
          setTransferModalOpen(v)
          if (!v) {
            const kind = transferPreset?.kind
            setTransferPreset(null)
            if (kind === "loan_emi") exitToLoansList()
            else if (kind === "credit_card_bill") exitToCardsList()
          }
        }}
        initialType="transfer"
        transferPaymentPreset={transferPreset}
        accountsReturnPath="/accounts"
      />
      {selectedAccount ? (
        <AccountDetailView
          key={`${selectedAccount.id}-${accountDetailOpenNonce}`}
          open
          onOpenChange={(v) => {
            if (!v) {
              setSelectedAccount(null)
              setAccountDetailStartInEdit(false)
            }
          }}
          account={resolvedSelectedAccount}
          onAccountUpdated={(a) => setSelectedAccount(a)}
          initialEditing={accountDetailStartInEdit}
          onAdjustBalance={() => {
            if (resolvedSelectedAccount) setAdjustBalanceAccount(resolvedSelectedAccount)
          }}
          onAccountDeleted={() => {
            setSelectedAccount(null)
            setAccountDetailStartInEdit(false)
          }}
        />
      ) : null}
      <UdharDetailsModal
        open={udharLedgerOpen}
        onOpenChange={(v) => {
          if (!v) {
            setUdharLedgerOpen(false)
            setUdharLedgerEntries([])
          }
        }}
        personName={udharLedgerName}
        entries={udharLedgerEntries}
        onDeleteEntry={txDelete.requestDelete}
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
                if (id !== "accounts") setSelectedAccount(null)
                if (id !== "loans") setSelectedLoan(null)
                if (id !== "cards") setSelectedCreditCard(null)
                setLoanDetailVisible(false)
                setCardDetailVisible(false)
                setCardInlineSpendOpen(false)
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev)
                    if (id === "loans") {
                      p.delete(ACCOUNTS_URL_CARD)
                    } else if (id === "cards") {
                      p.delete(ACCOUNTS_URL_LOAN)
                    } else {
                      p.delete(ACCOUNTS_URL_LOAN)
                      p.delete(ACCOUNTS_URL_CARD)
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
                + Add
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
              onPersonClick={() => {}}
              balanceByPersonId={EMPTY_LEDGER_BALANCE_MAP}
              pendingPersonIds={EMPTY_PENDING_IDS}
              balanceErrorByPersonId={EMPTY_LEDGER_ERR_MAP}
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
              {normalAccounts.length > 1 ? (
                <div className="space-y-1">
                  <Label htmlFor="people-account-filter" className="text-xs font-bold text-primary">
                    Account
                  </Label>
                  <select
                    id="people-account-filter"
                    value={peopleAccountId}
                    onChange={(e) => setPeopleAccountPick(e.target.value)}
                    className={cn(
                      "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none",
                      "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    )}
                  >
                    {normalAccounts.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {accountSelectLabel(a)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <PeopleList
                people={peopleForAccount}
                loading={showPeopleLoading && !peopleListError}
                error={peopleListError ? peopleQueryError : null}
                onRetry={() => void refetchPeople()}
                onPersonClick={onPersonClickLedger}
                onPersonDelete={(p) => setPendingDeletePerson(p)}
                balanceByPersonId={ledgerBalanceByPersonId}
                pendingPersonIds={ledgerPendingPersonIds}
                balanceErrorByPersonId={balanceErrorByPersonId}
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
                    setCardDetailVisible(true)
                    setSelectedCreditCard(a)
                    applyAccountsDetailSearch(setSearchParams, { kind: "card", id: String(a.id) })
                  }}
                  onAddSpend={(a) => {
                    setCardDetailVisible(false)
                    setSelectedCreditCard(a)
                    setCardInlineSpendOpen(true)
                  }}
                  onPayBill={(a) => {
                    setCardDetailVisible(false)
                    setSelectedCreditCard(a)
                    setTransferPreset({
                      kind: "credit_card_bill",
                      creditCardAccountId: String(a.id),
                    })
                    setTransferModalOpen(true)
                  }}
                />
              ) : segment === "loans" ? (
                <LoanList
                  accounts={loans}
                  variant="entries"
                  onSelectLoan={(a) => {
                    setLoanDetailVisible(true)
                    setSelectedLoan(a)
                    applyAccountsDetailSearch(setSearchParams, { kind: "loan", id: String(a.id) })
                  }}
                  onPayEmi={(a) => {
                    setLoanDetailVisible(false)
                    setSelectedLoan(a)
                    setTransferPreset({ kind: "loan_emi", loanAccountId: String(a.id) })
                    setTransferModalOpen(true)
                  }}
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
                          setAccountDetailStartInEdit(false)
                          setAccountDetailOpenNonce((n) => n + 1)
                          setSelectedAccount(a)
                        }}
                        onEdit={() => {
                          setAccountDetailStartInEdit(true)
                          setAccountDetailOpenNonce((n) => n + 1)
                          setSelectedAccount(a)
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
