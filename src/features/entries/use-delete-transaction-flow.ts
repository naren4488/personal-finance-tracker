import { useCallback, useState } from "react"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { useDeleteTransactionMutation } from "@/store/api/base-api"

/**
 * Shared confirm → DELETE /transactions/:id flow for all entry rows (income, expense, transfer, udhar, etc.).
 *
 * **After success:** `deleteTransaction` invalidates RTK tags so subscribed queries refetch:
 * - `GET /transactions/recent` (global views like home/entries)
 * - `GET /transactions/ledger` (entity views like account/person detail)
 * - `GET /accounts` (balances — reverse of the deleted entry’s effect on accounts)
 * - Dashboard/analytics/udhar/people rollups and commitment lists
 *
 * **Balance correctness:** Server is source of truth; refetch of `Account` list ensures balances match
 * backend after delete. Prefer this over optimistic balance math on the client.
 */
export function useDeleteTransactionFlow() {
  const [pending, setPending] = useState<RecentTransaction | null>(null)
  const [deleteTransaction, { isLoading: isDeleting }] = useDeleteTransactionMutation()

  const requestDelete = useCallback((tx: RecentTransaction) => {
    const id = String(tx.id ?? "").trim()
    if (!id) {
      toast.error("This entry cannot be deleted (missing id).")
      return
    }
    setPending(tx)
  }, [])

  const dismiss = useCallback(() => setPending(null), [])

  const confirmDelete = useCallback(async () => {
    if (!pending) return
    const id = String(pending.id).trim()
    if (!id) return
    try {
      const res = await deleteTransaction(id).unwrap()
      toast.success(res.message ?? "Deleted")
      setPending(null)
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete")
    }
  }, [deleteTransaction, pending])

  return {
    pending,
    confirmOpen: pending !== null,
    dismiss,
    requestDelete,
    confirmDelete,
    isDeleting,
  }
}
