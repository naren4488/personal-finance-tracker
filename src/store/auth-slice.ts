import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AuthUser } from "@/lib/api/auth-schemas"

type AuthState = {
  user: AuthUser | null
}

const initialState: AuthState = {
  user: null,
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
    },
    clearUser(state) {
      state.user = null
    },
  },
})

export const { setUser, clearUser } = authSlice.actions
