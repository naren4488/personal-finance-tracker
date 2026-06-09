import { createListenerMiddleware, isRejectedWithValue } from "@reduxjs/toolkit"
import { showApiErrorToast } from "@/lib/api/show-api-error-toast"
import { handleAuthApiErrorIfNeeded } from "@/lib/auth/handle-auth-api-error"
import { baseApi } from "@/store/api/base-api"
import type { AppDispatch } from "@/store/index"

/** Global toast for failed RTK Query mutations (forms keep inline validation separate). */
export const apiErrorListenerMiddleware = createListenerMiddleware()

const mutationRejectedType = `${baseApi.reducerPath}/executeMutation/rejected`

apiErrorListenerMiddleware.startListening({
  predicate: (action) => action.type === mutationRejectedType && isRejectedWithValue(action),
  effect: (action, listenerApi) => {
    const error = action.payload
    const meta = action.meta as { requestId?: string }
    const requestId = String(meta.requestId ?? "")
    if (handleAuthApiErrorIfNeeded(error, listenerApi.dispatch as AppDispatch)) {
      return
    }
    showApiErrorToast(error, { dedupeKey: requestId || undefined })
  },
})
