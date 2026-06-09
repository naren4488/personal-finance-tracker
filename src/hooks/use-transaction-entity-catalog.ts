import { useMemo } from "react"
import type { Account } from "@/lib/api/account-schemas"
import { accountKindNormalized } from "@/lib/api/account-schemas"
import { buildEntityCatalog, type EntityCatalog } from "@/lib/commitments/commitment-kind-config"
import { useGetAccountsQuery, useGetPeopleQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

function segmentAccounts(accounts: Account[]): { loans: Account[]; creditCards: Account[] } {
  const loans: Account[] = []
  const creditCards: Account[] = []
  for (const a of accounts) {
    const k = accountKindNormalized(a)
    if (k === "loan") loans.push(a)
    else if (k === "credit_card" || k === "creditcard") creditCards.push(a)
  }
  return { loans, creditCards }
}

export function useTransactionEntityCatalog(options?: {
  skip?: boolean
  transactions?: { id: string }[]
}): EntityCatalog | undefined {
  const user = useAppSelector((s) => s.auth.user)
  const skip = Boolean(options?.skip || !user)
  const { data: people = [] } = useGetPeopleQuery({}, { skip })
  const { data: allAccounts = [] } = useGetAccountsQuery(undefined, { skip })
  const transactions = options?.transactions

  return useMemo(() => {
    if (skip) return undefined
    const { loans, creditCards } = segmentAccounts(allAccounts)
    return buildEntityCatalog({
      people,
      loans,
      creditCards,
      allAccounts,
      transactions,
    })
  }, [skip, people, allAccounts, transactions])
}
