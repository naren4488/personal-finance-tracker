import { useCallback, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { DetailLayout } from "@/components/detail-layout"
import { AdjustBalanceSheet } from "@/features/accounts/adjust-balance-sheet"
import { AccountDetailView } from "@/features/accounts/account-detail-view"
import type { AccountsSegmentId } from "@/features/accounts/accounts-mock-data"
import { ACCOUNTS_HIGHLIGHT_TX } from "@/features/accounts/accounts-route"
import type { Account } from "@/lib/api/account-schemas"
import { filterNormalAccounts } from "@/lib/api/account-schemas"
import { useGetAccountsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

export default function AccountDetailPage() {
  const { accountId = "" } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAppSelector((s) => s.auth.user)
  const highlightTxQ = searchParams.get(ACCOUNTS_HIGHLIGHT_TX)
  const initialEditing = Boolean(
    (location.state as { initialEditing?: boolean } | null)?.initialEditing
  )

  const { data: apiAccounts = [], refetch } = useGetAccountsQuery(undefined, { skip: !user })
  const normalAccounts = useMemo(() => filterNormalAccounts(apiAccounts), [apiAccounts])
  const account = useMemo(() => {
    const id = accountId.trim()
    return normalAccounts.find((a) => String(a.id) === id) ?? null
  }, [normalAccounts, accountId])

  const [adjustBalanceAccount, setAdjustBalanceAccount] = useState<Account | null>(null)

  const onBack = useCallback(() => {
    navigate("/accounts", { state: { accountsSegment: "accounts" as AccountsSegmentId } })
  }, [navigate])

  const resolvedAdjust = useMemo(() => {
    if (!adjustBalanceAccount || !account) return null
    return String(adjustBalanceAccount.id) === String(account.id) ? account : adjustBalanceAccount
  }, [adjustBalanceAccount, account])

  if (!user) return null
  if (!accountId.trim()) {
    return (
      <DetailLayout>
        <main className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">Missing account.</p>
        </main>
      </DetailLayout>
    )
  }
  if (!account) {
    return (
      <DetailLayout>
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
          <p className="text-sm text-muted-foreground">Account not found.</p>
          <button
            type="button"
            className="mt-4 w-fit text-sm font-medium text-primary"
            onClick={onBack}
          >
            Back to Accounts
          </button>
        </main>
      </DetailLayout>
    )
  }

  return (
    <DetailLayout>
      <AccountDetailView
        key={`${String(account.id)}-${initialEditing ? "edit" : "view"}`}
        account={account}
        onBack={onBack}
        onAccountUpdated={() => void refetch()}
        initialEditing={initialEditing}
        onAccountDeleted={onBack}
        onAdjustBalance={() => setAdjustBalanceAccount(account)}
        highlightTransactionId={highlightTxQ}
        onHighlightTransactionConsumed={() => {
          setSearchParams(
            (prev) => {
              const p = new URLSearchParams(prev)
              p.delete(ACCOUNTS_HIGHLIGHT_TX)
              return p
            },
            { replace: true }
          )
        }}
      />
      <AdjustBalanceSheet
        open={!!adjustBalanceAccount}
        onOpenChange={(v) => {
          if (!v) setAdjustBalanceAccount(null)
        }}
        account={resolvedAdjust}
      />
    </DetailLayout>
  )
}
