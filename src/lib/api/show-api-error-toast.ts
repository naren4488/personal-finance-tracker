import { toast } from "sonner"
import { getBackendToastMessage } from "@/lib/api/errors"

const recentToastKeys = new Map<string, number>()
const DEDUPE_MS = 800

/**
 * Show a top toast for server/API failures.
 * Deduplicates rapid repeats (e.g. global listener + local catch).
 */
export function showApiErrorToast(error: unknown, options?: { dedupeKey?: string }): void {
  const message = getBackendToastMessage(error)
  const key = options?.dedupeKey ?? message
  const now = Date.now()
  const last = recentToastKeys.get(key)
  if (last != null && now - last < DEDUPE_MS) return
  recentToastKeys.set(key, now)
  toast.error(message)
}
