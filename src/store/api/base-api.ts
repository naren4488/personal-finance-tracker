import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { AUTH_PATHS } from "@/api/auth-paths"
import { getApiBaseUrl } from "@/lib/env"
import { setAuthTokens } from "@/lib/auth/token"
import {
  parseApiFailureMessage,
  parseAuthSuccessResponse,
  type AuthResult,
  type LoginRequest,
  type RegisterRequest,
} from "@/lib/api/auth-schemas"
import {
  transactionListSchema,
  transactionSchema,
  type QuickTransactionPayload,
  type Transaction,
} from "@/lib/api/schemas"
import { mockTransactions } from "@/lib/api/mock-transactions"
import { getToken } from "@/lib/auth/token"
import { getErrorMessage } from "@/lib/api/errors"
import {
  isAuthApiDebugEnabled,
  logAuthFailure,
  logAuthRequestStart,
  logAuthResponseParsed,
  logAuthResponseSuccess,
} from "@/lib/debug/auth-api-log"
import { setUser } from "@/store/auth-slice"

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeFetchError(error: FetchBaseQueryError): FetchBaseQueryError {
  if (typeof error.status !== "number") {
    return error
  }
  const fromEnvelope = parseApiFailureMessage(error.data)
  if (fromEnvelope) {
    return { status: error.status, data: fromEnvelope }
  }
  if (
    typeof error.data === "object" &&
    error.data !== null &&
    "message" in error.data &&
    typeof (error.data as { message: unknown }).message === "string"
  ) {
    return {
      status: error.status,
      data: (error.data as { message: string }).message,
    }
  }
  return error
}

async function persistAuthSession(dispatch: (action: unknown) => void, data: AuthResult) {
  setAuthTokens(data.accessToken, data.refreshToken)
  dispatch(setUser(data.user))
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: (headers) => {
      const token = getToken()
      if (token) {
        headers.set("Authorization", `Bearer ${token}`)
      }
      headers.set("Content-Type", "application/json")
      return headers
    },
  }),
  tagTypes: ["Transaction"],
  endpoints: (build) => ({
    register: build.mutation<AuthResult, RegisterRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        logAuthRequestStart("register", AUTH_PATHS.register, "POST", body)
        const res = await baseQuery({
          url: AUTH_PATHS.register,
          method: "POST",
          body,
        })
        if (res.error) {
          const normalized = normalizeFetchError(res.error)
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("register", "http", res.error, getErrorMessage(normalized))
          }
          return { error: normalized }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("register", "success-false", res.data, failMsg)
          }
          return { error: { status: 400, data: failMsg } }
        }
        logAuthResponseSuccess("register", res.data)
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("register", "parse", res.data, parsed.error)
          }
          return { error: { status: 422, data: parsed.error } }
        }
        logAuthResponseParsed("register", parsed.result)
        return { data: parsed.result }
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          persistAuthSession(dispatch, data)
        } catch {
          /* surfaced in UI */
        }
      },
    }),

    login: build.mutation<AuthResult, LoginRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        logAuthRequestStart("login", AUTH_PATHS.login, "POST", body)
        const res = await baseQuery({
          url: AUTH_PATHS.login,
          method: "POST",
          body,
        })
        if (res.error) {
          const normalized = normalizeFetchError(res.error)
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("login", "http", res.error, getErrorMessage(normalized))
          }
          return { error: normalized }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("login", "success-false", res.data, failMsg)
          }
          return { error: { status: 401, data: failMsg } }
        }
        logAuthResponseSuccess("login", res.data)
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("login", "parse", res.data, parsed.error)
          }
          return { error: { status: 422, data: parsed.error } }
        }
        logAuthResponseParsed("login", parsed.result)
        return { data: parsed.result }
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          persistAuthSession(dispatch, data)
        } catch {
          /* surfaced in UI */
        }
      },
    }),

    getTransactions: build.query<Transaction[], void>({
      async queryFn() {
        await delay(200)
        const parsed = transactionListSchema.safeParse(mockTransactions)
        if (!parsed.success) {
          return {
            error: {
              status: 422,
              data: "Response did not match transaction schema",
            },
          }
        }
        return { data: parsed.data }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Transaction" as const, id })),
              { type: "Transaction", id: "LIST" },
            ]
          : [{ type: "Transaction", id: "LIST" }],
    }),

    addTransaction: build.mutation<Transaction, QuickTransactionPayload>({
      async queryFn(body) {
        await delay(150)
        const next: Transaction = {
          id: crypto.randomUUID(),
          title: body.title,
          amount: body.amount,
          type: body.type,
          date: new Date().toISOString().slice(0, 10),
        }
        const parsed = transactionSchema.safeParse(next)
        if (!parsed.success) {
          return { error: { status: 400, data: "Invalid transaction payload" } }
        }
        mockTransactions.unshift(parsed.data)
        return { data: parsed.data }
      },
      invalidatesTags: [{ type: "Transaction", id: "LIST" }],
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useGetTransactionsQuery,
  useAddTransactionMutation,
} = baseApi
