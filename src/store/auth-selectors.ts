import type { RootState } from "@/store"

export const selectAuthUser = (state: RootState) => state.auth.user
export const selectSessionStatus = (state: RootState) => state.auth.sessionStatus
export const selectIsSessionReady = (state: RootState) => state.auth.sessionStatus === "ready"
export const selectShowAuthSessionSplash = (state: RootState) =>
  state.auth.sessionStatus === "unknown" || state.auth.sessionStatus === "restoring"
/** Authenticated = validated user in Redux; never inferred from localStorage tokens alone. */
export const selectIsAuthenticated = (state: RootState) => state.auth.user != null
