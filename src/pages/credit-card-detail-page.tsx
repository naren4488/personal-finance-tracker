import { useCallback, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { DetailLayout } from "@/components/detail-layout"
import { AddCardSpendSheet } from "@/features/accounts/add-card-spend-sheet"
import { CreditCardDetailView } from "@/features/accounts/credit-card-detail-view"
import type { AccountsSegmentId } from "@/features/accounts/accounts-mock-data"
import { buildAccountsDetailPath } from "@/features/accounts/accounts-route"
import type { Account } from "@/lib/api/account-schemas"
import {
  AddTransactionModal,
  type TransferPaymentPreset,
} from "@/features/entries/add-transaction-modal"
import { useGetCreditCardsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

export default function CreditCardDetailPage() {
  const { cardId = "" } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const {
    data: creditCards = [],
    isLoading,
    refetch,
  } = useGetCreditCardsQuery(undefined, { skip: !user })
  const id = cardId.trim()
  const fromList = useMemo(
    () => (id ? (creditCards.find((a) => String(a.id) === id) ?? null) : null),
    [creditCards, id]
  )
  const [patchedForId, setPatchedForId] = useState<{ id: string; account: Account } | null>(null)
  const patched = patchedForId?.id === id ? patchedForId.account : null
  const account = patched ?? fromList

  const [spendOpen, setSpendOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPreset, setTransferPreset] = useState<TransferPaymentPreset | null>(null)
  const transferSuccessSkipExitRef = useRef(false)

  const onBack = useCallback(() => {
    navigate("/accounts", { state: { accountsSegment: "cards" as AccountsSegmentId } })
  }, [navigate])

  const onPayBill = useCallback(() => {
    if (!account) return
    setTransferPreset({ kind: "credit_card_bill", creditCardAccountId: String(account.id) })
    setTransferModalOpen(true)
  }, [account])

  if (!user) return null
  if (!id) {
    return (
      <DetailLayout>
        <main className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">Missing card.</p>
        </main>
      </DetailLayout>
    )
  }
  if (!isLoading && !account) {
    return (
      <DetailLayout>
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
          <p className="text-sm text-muted-foreground">Card not found.</p>
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
  if (!account) {
    return (
      <DetailLayout>
        <main className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      </DetailLayout>
    )
  }

  return (
    <DetailLayout>
      <CreditCardDetailView
        account={account}
        onBack={onBack}
        onCardUpdated={(a) => {
          setPatchedForId({ id, account: a })
          void refetch()
        }}
        onPayBill={onPayBill}
        onAddSpend={() => setSpendOpen(true)}
        onCardDeleted={onBack}
      />
      <AddCardSpendSheet open={spendOpen} onOpenChange={setSpendOpen} account={account} />
      <AddTransactionModal
        open={transferModalOpen}
        onOpenChange={(v) => {
          setTransferModalOpen(v)
          if (!v) {
            const kind = transferPreset?.kind
            const skip = transferSuccessSkipExitRef.current
            transferSuccessSkipExitRef.current = false
            setTransferPreset(null)
            if (skip) return
            if (kind === "credit_card_bill") {
              // remain on page
            }
          }
        }}
        initialType="transfer"
        transferPaymentPreset={transferPreset}
        accountsReturnPath="/accounts"
        successNavigateTo={
          transferPreset?.kind === "credit_card_bill"
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
    </DetailLayout>
  )
}
