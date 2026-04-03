import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"
import { baseApi } from "@/store/api/base-api"
import { authSlice } from "@/store/auth-slice"
import { peopleSlice } from "@/store/people-slice"

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    people: peopleSlice.reducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
