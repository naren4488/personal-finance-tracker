import { useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { buildAccountsDetailPath } from "@/features/accounts/accounts-route"
import { AddTransactionModal } from "@/features/entries/add-transaction-modal"

export default function AddTransactionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accountId = searchParams.get("accountId")?.trim() ?? ""

  const successNavigateTo = useMemo(() => {
    if (!accountId) return null
    return buildAccountsDetailPath({ kind: "account", id: accountId })
  }, [accountId])

  return (
    <AddTransactionModal
      open={true}
      onOpenChange={(next) => {
        if (!next) navigate(-1)
      }}
      prefillAccountId={accountId || null}
      successNavigateTo={successNavigateTo}
    />
  )
}
