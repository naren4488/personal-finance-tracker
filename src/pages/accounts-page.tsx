import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CreditCard, Landmark, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AddAccountSheet } from "@/features/accounts/add-account-sheet"
import { AddCreditCardSheet } from "@/features/accounts/add-credit-card-sheet"
import { AddLoanSheet } from "@/features/accounts/add-loan-sheet"
import { AddUdharEntrySheet } from "@/features/accounts/add-udhar-entry-sheet"
import { AccountRowCard } from "@/features/accounts/account-list-rows"
import {
  ACCOUNTS_MOCK_BY_SEGMENT,
  ACCOUNTS_SEGMENT_META,
  type AccountsSegmentId,
  type AccountListItem,
} from "@/features/accounts/accounts-mock-data"
import { CreditCardDetailView } from "@/features/accounts/credit-card-detail-view"
import { CreditCardList } from "@/features/accounts/credit-card-list"
import { UdharDetailsModal } from "@/features/accounts/udhar-details-modal"
import { UdharEntryRow } from "@/features/accounts/udhar-entry-row"
import type { Account } from "@/lib/api/account-schemas"
import { accountBalanceInrFromApi, accountSubtitleForList } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import {
  inferUdharPersonName,
  isUdharRecentTransaction,
  parseSignedAmountString,
  type RecentTransaction,
  udharDirectionLabel,
} from "@/lib/api/transaction-schemas"
import { cn } from "@/lib/utils"
import {
  useGetAccountsQuery,
  useGetCreditCardsQuery,
  useGetRecentTransactionsQuery,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

const SEGMENT_ORDER: AccountsSegmentId[] = ["accounts", "people", "loans", "cards"]

const SEGMENT_ICONS: Record<AccountsSegmentId, typeof Users> = {
  accounts: Wallet,
  people: Users,
  loans: Landmark,
  cards: CreditCard,
}

type PersonUdharGroup = {
  id: string
  name: string
  amountInr: number
  entries: RecentTransaction[]
}

export default function AccountsPage() {
  const navigate = useNavigate()
  const [segment, setSegment] = useState<AccountsSegmentId>("accounts")
  const [udharOpen, setUdharOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedCreditCard, setSelectedCreditCard] = useState<Account | null>(null)

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
    data: recentTransactions = [],
    isLoading: recentLoading,
    isError: recentError,
    error: recentQueryError,
    refetch: refetchRecent,
  } = useGetRecentTransactionsQuery(5000, { refetchOnMountOrArgChange: true })

  useEffect(() => {
    if (!creditCardsError || !creditCardsQueryError) return
    const msg = getErrorMessage(creditCardsQueryError)
    if (/authorization token is required/i.test(msg)) {
      toast.error("Session expired, please login again")
      navigate("/login", { replace: true })
    }
  }, [creditCardsError, creditCardsQueryError, navigate])

  const peopleGroups = useMemo((): PersonUdharGroup[] => {
    const aggregate = new Map<string, PersonUdharGroup>()

    for (const tx of recentTransactions) {
      if (!isUdharRecentTransaction(tx)) continue
      const rec = tx as unknown as Record<string, unknown>
      const personId =
        typeof rec.personId === "string" && rec.personId.trim() ? rec.personId : undefined
      const key = personId
        ? `person:${personId}`
        : inferUdharPersonName(tx).trim().toLowerCase() || tx.id
      const signed = parseSignedAmountString(tx.signedAmount)
      const direction = udharDirectionLabel(tx)
      const amt = direction === "given" ? -Math.abs(signed) : Math.abs(signed)
      const name = inferUdharPersonName(tx)
      const prev = aggregate.get(key)
      if (prev) {
        prev.amountInr += amt
        prev.entries.push(tx)
      } else {
        aggregate.set(key, { id: key, name, amountInr: amt, entries: [tx] })
      }
    }

    const groups = Array.from(aggregate.values())
    groups.forEach((g) => {
      g.entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    })
    return groups.sort((a, b) => b.entries.length - a.entries.length)
  }, [recentTransactions])

  const peopleRows = useMemo((): AccountListItem[] => {
    return peopleGroups.map((g) => ({
      id: g.id,
      name: g.name,
      amountInr: g.amountInr,
      entryCount: g.entries.length,
    }))
  }, [peopleGroups])
  const selectedPeopleGroup = useMemo(
    () => (selectedGroupId ? (peopleGroups.find((g) => g.id === selectedGroupId) ?? null) : null),
    [selectedGroupId, peopleGroups]
  )

  const accountListFromApi: AccountListItem[] = useMemo(() => {
    const list = apiAccounts ?? []
    return list.map((a) => ({
      id: a.id,
      name: a.name,
      entryCount: 0,
      amountInr: accountBalanceInrFromApi(a),
      subtitle: accountSubtitleForList(a),
    }))
  }, [apiAccounts])

  const items =
    segment === "people"
      ? peopleRows
      : segment === "accounts"
        ? accountListFromApi
        : segment === "cards"
          ? []
          : ACCOUNTS_MOCK_BY_SEGMENT[segment]

  const showPeopleLoading = segment === "people" && recentLoading
  const showPeopleError = segment === "people" && recentError

  const showAccountsLoading = segment === "accounts" && accountsLoading
  const showAccountsError = segment === "accounts" && accountsError
  const showAccountsEmpty =
    segment === "accounts" &&
    !showAccountsLoading &&
    !showAccountsError &&
    accountListFromApi.length === 0

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

  const showLoansEmpty = segment === "loans" && items.length === 0
  const showCardsEmpty =
    segment === "cards" && !creditCardsLoading && !creditCardsError && creditCards.length === 0

  const showHeaderAdd =
    (segment === "accounts" &&
      !showAccountsLoading &&
      !showAccountsError &&
      accountListFromApi.length > 0) ||
    (segment === "people" && !showPeopleLoading && !showPeopleError && peopleRows.length > 0) ||
    (segment === "loans" && !showLoansEmpty) ||
    (segment === "cards" && !creditCardsLoading && !creditCardsError && creditCards.length > 0)

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 py-4 pb-28">
      <AddAccountSheet open={addAccountOpen} onOpenChange={setAddAccountOpen} />
      <AddUdharEntrySheet open={udharOpen} onOpenChange={setUdharOpen} />
      <AddLoanSheet open={loanOpen} onOpenChange={setLoanOpen} />
      <AddCreditCardSheet open={cardOpen} onOpenChange={setCardOpen} />
      <CreditCardDetailView
        open={!!selectedCreditCard}
        onOpenChange={(v) => {
          if (!v) setSelectedCreditCard(null)
        }}
        account={selectedCreditCard}
      />
      <UdharDetailsModal
        open={!!selectedPeopleGroup}
        onOpenChange={(v) => {
          if (!v) setSelectedGroupId(null)
        }}
        personName={selectedPeopleGroup?.name ?? ""}
        entries={selectedPeopleGroup?.entries ?? []}
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
              onClick={() => setSegment(id)}
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
          <div className="flex flex-col gap-2">
            <Skeleton className="h-18 w-full rounded-2xl" />
            <Skeleton className="h-18 w-full rounded-2xl" />
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
        ) : showPeopleLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : showPeopleError ? (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
            <p className="text-sm text-destructive">{getErrorMessage(recentQueryError)}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                refetchRecent()
              }}
            >
              Retry
            </Button>
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
        ) : showLoansEmpty ? (
          <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
            <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
                <Landmark className="size-7 text-primary" strokeWidth={2} aria-hidden />
              </div>
              <p className="text-base font-bold text-primary">No loans</p>
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
                variant="accounts"
                onSelectCard={setSelectedCreditCard}
              />
            ) : (
              <ul className="flex list-none flex-col gap-2.5" aria-label={`${meta.listTitle} list`}>
                {segment === "people"
                  ? peopleGroups.map((group) => (
                      <li key={group.id}>
                        <UdharEntryRow
                          personName={group.name}
                          amountInr={Math.abs(group.amountInr)}
                          direction={group.amountInr >= 0 ? "given" : "taken"}
                          entryCount={group.entries.length}
                          statusLabel={group.amountInr >= 0 ? "to receive" : "to pay"}
                          onClick={() => setSelectedGroupId(group.id)}
                        />
                      </li>
                    ))
                  : items.map((item) => (
                      <li key={item.id}>
                        <AccountRowCard item={item} />
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
