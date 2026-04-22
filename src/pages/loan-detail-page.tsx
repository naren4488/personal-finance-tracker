import { useCallback, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { DetailLayout } from "@/components/detail-layout"
import { LoanDetailView } from "@/features/accounts/loan-detail-view"
import type { AccountsSegmentId } from "@/features/accounts/accounts-mock-data"
import { buildAccountsDetailPath } from "@/features/accounts/accounts-route"
import type { Account } from "@/lib/api/account-schemas"
import {
  AddTransactionModal,
  type TransferPaymentPreset,
} from "@/features/entries/add-transaction-modal"
import { useGetLoansQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

export default function LoanDetailPage() {
  const { loanId = "" } = useParams<{ loanId: string }>()
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const { data: loans = [], isLoading, refetch } = useGetLoansQuery(undefined, { skip: !user })
  const id = loanId.trim()
  const fromList = useMemo(
    () => (id ? (loans.find((a) => String(a.id) === id) ?? null) : null),
    [loans, id]
  )
  const [patchedForId, setPatchedForId] = useState<{ id: string; account: Account } | null>(null)
  const patched = patchedForId?.id === id ? patchedForId.account : null
  const account = patched ?? fromList

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferPreset, setTransferPreset] = useState<TransferPaymentPreset | null>(null)
  const transferSuccessSkipExitRef = useRef(false)

  const onBack = useCallback(() => {
    navigate("/accounts", { state: { accountsSegment: "loans" as AccountsSegmentId } })
  }, [navigate])

  const onPayEmi = useCallback(() => {
    if (!account) return
    setTransferPreset({ kind: "loan_emi", loanAccountId: String(account.id) })
    setTransferModalOpen(true)
  }, [account])

  if (!user) return null
  if (!id) {
    return (
      <DetailLayout>
        <main className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">Missing loan.</p>
        </main>
      </DetailLayout>
    )
  }
  if (!isLoading && !account) {
    return (
      <DetailLayout>
        <main className="flex min-h-0 flex-1 flex-col px-4 pb-28 pt-4">
          <p className="text-sm text-muted-foreground">Loan not found.</p>
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
      <LoanDetailView
        account={account}
        onBack={onBack}
        onLoanUpdated={(a) => {
          setPatchedForId({ id, account: a })
          void refetch()
        }}
        onPayEmi={onPayEmi}
        onLoanDeleted={onBack}
      />
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
            if (kind === "loan_emi") {
              // stay on this page; list is optional
            }
          }
        }}
        initialType="transfer"
        transferPaymentPreset={transferPreset}
        accountsReturnPath="/accounts"
        successNavigateTo={
          transferPreset?.kind === "loan_emi"
            ? buildAccountsDetailPath({ kind: "loan", id: transferPreset.loanAccountId })
            : null
        }
        onTransactionSuccess={() => {
          transferSuccessSkipExitRef.current = true
        }}
      />
    </DetailLayout>
  )
}
