import { useCallback, useState } from "react"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/api/errors"
import type { Commitment } from "@/lib/api/commitment-schemas"
import { handleAuthApiErrorIfNeeded } from "@/lib/auth/handle-auth-api-error"
import { useDeleteCommitmentMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

export function useDeleteCommitmentFlow() {
  const dispatch = useAppDispatch()
  const [pending, setPending] = useState<Commitment | null>(null)
  const [deleteCommitment, { isLoading: isDeleting }] = useDeleteCommitmentMutation()

  const requestDelete = useCallback((commitment: Commitment) => {
    const id = String(commitment.id ?? "").trim()
    if (!id) {
      toast.error("This commitment cannot be deleted (missing id).")
      return
    }
    setPending(commitment)
  }, [])

  const dismiss = useCallback(() => setPending(null), [])

  const confirmDelete = useCallback(async () => {
    if (!pending) return
    const id = String(pending.id).trim()
    if (!id) return
    try {
      const res = await deleteCommitment(id).unwrap()
      toast.success(res.message ?? "Commitment deleted")
      setPending(null)
    } catch (err) {
      if (handleAuthApiErrorIfNeeded(err, dispatch)) {
        setPending(null)
        return
      }
      toast.error(getErrorMessage(err))
    }
  }, [deleteCommitment, dispatch, pending])

  return {
    pending,
    confirmOpen: pending !== null,
    dismiss,
    requestDelete,
    confirmDelete,
    isDeleting,
  }
}
