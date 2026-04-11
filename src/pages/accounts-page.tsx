import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CreditCard, Landmark, Users, Wallet } from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AddAccountSheet } from "@/features/accounts/add-account-sheet"
import { AddCreditCardSheet } from "@/features/accounts/add-credit-card-sheet"
import { AddLoanSheet } from "@/features/accounts/add-loan-sheet"
import { AddUdharEntrySheet } from "@/features/accounts/add-udhar-entry-sheet"
import { AccountCard, AccountCardSkeleton } from "@/features/accounts/account-card"
import { AccountDetailView } from "@/features/accounts/account-detail-view"
import {
  ACCOUNTS_SEGMENT_META,
  type AccountsSegmentId,
} from "@/features/accounts/accounts-mock-data"
import { CreditCardDetailView } from "@/features/accounts/credit-card-detail-view"
import { CreditCardList } from "@/features/accounts/credit-card-list"
import { LoanDetailView } from "@/features/accounts/loan-detail-view"
import { LoanList } from "@/features/accounts/loan-list"
import { PeopleList } from "@/features/accounts/people-list"
import { UdharDetailsModal } from "@/features/accounts/udhar-details-modal"
import {
  AddTransactionModal,
  type TransferPaymentPreset,
} from "@/features/entries/add-transaction-modal"
import type { LoanPaymentMode } from "@/features/accounts/record-loan-payment-sheet"
import type { Account } from "@/lib/api/account-schemas"
import { getAccountDeleteWarning } from "@/lib/accounts/account-delete"
import { accountSelectLabel, filterNormalAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { resolvePersonDeleteTarget } from "@/lib/people/person-delete"
import type { Person } from "@/lib/api/people-schemas"
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

export default function AccountsPage() {
  const navigate = useNavigate()
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
  const [loanPaymentRequest, setLoanPaymentRequest] = useState<{ mode: LoanPaymentMode } | null>(
    null
  )
  const [cardSheetRequest, setCardSheetRequest] = useState<"spend" | "pay_bill" | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPreset, setTransferPreset] = useState<TransferPaymentPreset | null>(null)
  const [accountDetailStartInEdit, setAccountDetailStartInEdit] = useState(false)
  const [accountDetailOpenNonce, setAccountDetailOpenNonce] = useState(0)
  const [pendingListDeleteAccount, setPendingListDeleteAccount] = useState<Account | null>(null)
  const [pendingDeletePerson, setPendingDeletePerson] = useState<Person | null>(null)
  const [isConfirmingPersonDelete, setIsConfirmingPersonDelete] = useState(false)
  const [deleteAccount, { isLoading: isDeletingFromList }] = useDeleteAccountMutation()
  const [deletePerson] = useDeletePersonMutation()

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

  const consumeLoanPaymentRequest = useCallback(() => {
    setLoanPaymentRequest(null)
  }, [])

  const consumeCardSheetRequest = useCallback(() => {
    setCardSheetRequest(null)
  }, [])

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
    isError: creditCardsError,
    error: creditCardsQueryError,
    refetch: refetchCreditCards,
  } = useGetCreditCardsQuery(undefined, { skip: !user || segment !== "cards" })

  const {
    data: loans = [],
    isLoading: loansLoading,
    isError: loansError,
    error: loansQueryError,
    refetch: refetchLoans,
  } = useGetLoansQuery(undefined, { skip: !user || segment !== "loans" })

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
        const entries = await fetchPersonLedger({ personId: person.id, limit: 500 }).unwrap()
        setUdharLedgerName(person.name)
        setUdharLedgerEntries(entries)
        setUdharLedgerOpen(true)
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    },
    [fetchPersonLedger]
  )

  const {
    data: peopleForAccount = [],
    isLoading: peopleQueryLoading,
    isFetching: peopleQueryFetching,
    isError: peopleListError,
    error: peopleQueryError,
    refetch: refetchPeople,
  } = useGetPeopleQuery(
    { accountId: peopleAccountId },
    { skip: !user || segment !== "people" || !peopleAccountId }
  )

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
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 py-4 pb-28">
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
      <AddAccountSheet open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <AddUdharEntrySheet open={udharOpen} onOpenChange={setUdharOpen} />
      <AddLoanSheet open={loanOpen} onOpenChange={setLoanOpen} />
      <AddCreditCardSheet open={cardOpen} onOpenChange={setCardOpen} />
      <CreditCardDetailView
        open={!!selectedCreditCard}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedCreditCard(null)
            setCardSheetRequest(null)
          }
        }}
        account={resolvedSelectedCreditCard}
        onCardUpdated={(a) => setSelectedCreditCard(a)}
        openSheetRequest={cardSheetRequest}
        onOpenSheetRequestConsumed={consumeCardSheetRequest}
        onPayBill={openPayBillFromCardDetail}
        onCardDeleted={() => setSelectedCreditCard(null)}
      />
      <LoanDetailView
        open={!!selectedLoan}
        onOpenChange={(v) => {
          if (!v) {
            setSelectedLoan(null)
            setLoanPaymentRequest(null)
          }
        }}
        account={resolvedSelectedLoan}
        onLoanUpdated={(a) => setSelectedLoan(a)}
        openPaymentRequest={loanPaymentRequest}
        onOpenPaymentRequestConsumed={consumeLoanPaymentRequest}
        onPayEmi={openPayEmiFromLoanDetail}
        onLoanDeleted={() => setSelectedLoan(null)}
      />
      <AddTransactionModal
        open={transferModalOpen}
        onOpenChange={(v) => {
          setTransferModalOpen(v)
          if (!v) setTransferPreset(null)
        }}
        initialType="transfer"
        transferPaymentPreset={transferPreset}
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
      />

      <div
        className="mb-3 grid grid-cols-4 gap-1 sm:mb-4"
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

      <div className="mb-3 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h1
            className={cn(
              "text-lg font-bold tracking-tight",
              segment === "loans" || segment === "cards" ? "text-primary" : "text-foreground"
            )}
          >
            {meta.listTitle}
          </h1>
          {showHeaderAdd ? (
            <Button
              type="button"
              variant="link"
              className="h-auto shrink-0 p-0 text-sm font-semibold text-primary"
              onClick={openHeaderAdd}
              aria-label={headerAddAriaLabel[segment]}
            >
              + Add
            </Button>
          ) : null}
        </div>

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
          <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
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
              />
            </div>
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
          <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
            {segment === "cards" ? (
              <CreditCardList
                accounts={creditCards}
                variant="entries"
                onSelectCard={setSelectedCreditCard}
                onAddSpend={(a) => {
                  setSelectedCreditCard(a)
                  setCardSheetRequest("spend")
                }}
                onPayBill={(a) => {
                  setSelectedCreditCard(a)
                  setCardSheetRequest("pay_bill")
                }}
              />
            ) : segment === "loans" ? (
              <LoanList
                accounts={loans}
                variant="entries"
                onSelectLoan={(a) => setSelectedLoan(a)}
                onPayEmi={(a) => {
                  setSelectedLoan(a)
                  setLoanPaymentRequest({ mode: "pay_emi" })
                }}
              />
            ) : (
              <ul className="flex list-none flex-col gap-2.5" aria-label={`${meta.listTitle} list`}>
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
                      onDelete={() => setPendingListDeleteAccount(a)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
