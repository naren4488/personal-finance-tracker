import { clearAllProfileDraftsFromStorage } from "@/lib/profile/local-profile-draft"
import { clearToken } from "@/lib/auth/token"
import { baseApi } from "@/store/api/base-api"
import { clearUser } from "@/store/auth-slice"
import { resetPeople } from "@/store/people-slice"
import type { AppDispatch } from "@/store"

/**
 * Full client sign-out: tokens, auth user, RTK Query cache, people slice, profile drafts.
 * Call this from every logout / forced sign-out path so no prior user data remains.
 */
export function endUserSession(dispatch: AppDispatch) {
  clearAllProfileDraftsFromStorage()
  clearToken()
  dispatch(clearUser())
  dispatch(baseApi.util.resetApiState())
  dispatch(resetPeople())
}
