import { useMemo } from "react"
import type { Person } from "@/lib/api/people-schemas"
import {
  buildPersonUdharActivityIndex,
  orderPeopleForUdharDisplay,
  PEOPLE_ACTIVITY_FROM_DATE,
  peopleActivityToDate,
} from "@/lib/people/person-list-order"
import { useGetRecentTransactionsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

type UseOrderedPeopleForUdharOptions = {
  search?: string
  /** When false, skips recent-transaction fetch and only applies search + stable name tie-break. */
  enabled?: boolean
}

export function useOrderedPeopleForUdhar(
  people: Person[],
  options?: UseOrderedPeopleForUdharOptions
): Person[] {
  const user = useAppSelector((s) => s.auth.user)
  const enabled = options?.enabled !== false && Boolean(user)

  const { data: recentTransactions = [] } = useGetRecentTransactionsQuery(
    {
      limit: 500,
      fromDate: PEOPLE_ACTIVITY_FROM_DATE,
      toDate: peopleActivityToDate(),
    },
    { skip: !enabled }
  )

  const activityIndex = useMemo(
    () => buildPersonUdharActivityIndex(recentTransactions),
    [recentTransactions]
  )

  return useMemo(
    () =>
      orderPeopleForUdharDisplay(people, {
        search: options?.search,
        activityIndex: enabled ? activityIndex : undefined,
      }),
    [people, options?.search, activityIndex, enabled]
  )
}
