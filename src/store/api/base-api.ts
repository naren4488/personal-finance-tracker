import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { ACCOUNT_PATHS } from "@/api/account-paths"
import { AUTH_PATHS } from "@/api/auth-paths"
import { PEOPLE_PATHS } from "@/api/people-paths"
import { getApiBaseUrl } from "@/lib/env"
import { clearToken, getRefreshToken, setAuthTokens } from "@/lib/auth/token"
import {
  parseApiFailureMessage,
  parseAuthSuccessResponse,
  parseLogoutSuccess,
  type AuthResult,
  type LoginRequest,
  type RegisterRequest,
} from "@/lib/api/auth-schemas"
import { parseGetAccountsSuccess, type Account } from "@/lib/api/account-schemas"
import {
  parseCreatePersonSuccess,
  parseGetPeopleSuccess,
  type CreatePersonRequest,
  type Person,
} from "@/lib/api/people-schemas"
import {
  transactionListSchema,
  transactionSchema,
  type CreateTransactionPayload,
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
import { clearUser, setUser } from "@/store/auth-slice"
import { addPerson, setPeople } from "@/store/people-slice"

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

function isRefreshRequest(args: string | FetchArgs): boolean {
  const url = typeof args === "string" ? args : args.url
  return url === AUTH_PATHS.refreshToken
}

function isLogoutRequest(args: string | FetchArgs): boolean {
  const url = typeof args === "string" ? args : args.url
  return url === AUTH_PATHS.logout
}

function tryApplyAuthResponse(data: unknown, api: BaseQueryApi): boolean {
  const failMsg = parseApiFailureMessage(data)
  if (failMsg) return false
  const parsed = parseAuthSuccessResponse(data)
  if (!parsed.ok) return false
  setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
  api.dispatch(setUser(parsed.result.user))
  return true
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  prepareHeaders: (headers) => {
    const token = getToken()
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    headers.set("Content-Type", "application/json")
    return headers
  },
})

let refreshInFlight: Promise<boolean> | null = null

function performTokenRefresh(api: BaseQueryApi): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return Promise.resolve(false)

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await rawBaseQuery(
          {
            url: AUTH_PATHS.refreshToken,
            method: "POST",
            body: { refreshToken: rt },
          },
          api,
          {}
        )
        if (res.error) return false
        return tryApplyAuthResponse(res.data, api)
      } finally {
        refreshInFlight = null
      }
    })()
  }

  return refreshInFlight
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401 && !isRefreshRequest(args) && !isLogoutRequest(args)) {
    const refreshed = await performTokenRefresh(api)
    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions)
    } else {
      api.dispatch(clearUser())
      clearToken()
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Transaction", "People", "Account"],
  endpoints: (build) => ({
    getAccounts: build.query<Account[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: ACCOUNT_PATHS.list,
          method: "GET",
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseGetAccountsSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.accounts }
      },
      providesTags: [{ type: "Account", id: "LIST" }],
    }),

    getPeople: build.query<Person[], void>({
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        console.log("Fetching people...")
        const res = await baseQuery({
          url: PEOPLE_PATHS.list,
          method: "GET",
        })
        console.log("API response:", res.data)
        if (res.error) {
          console.error("Error:", res.error)
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          console.error(failMsg)
          return { error: { status: 401, data: failMsg } }
        }
        const parsed = parseGetPeopleSuccess(res.data)
        if (!parsed.ok) {
          console.error(parsed.error)
          return { error: { status: 422, data: parsed.error } }
        }
        const people = parsed.data.people
        console.log("People fetched successfully", parsed.data)
        console.log("People:", people)
        api.dispatch(setPeople(people))
        return { data: people }
      },
      providesTags: [{ type: "People", id: "LIST" }],
    }),

    createPerson: build.mutation<Person, CreatePersonRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
        const payload = {
          name: body.name.trim(),
          phoneNumber: body.phoneNumber?.trim() ?? "",
        }
        const res = await baseQuery({
          url: PEOPLE_PATHS.create,
          method: "POST",
          body: payload,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseCreatePersonSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        api.dispatch(addPerson(parsed.person))
        return { data: parsed.person }
      },
      invalidatesTags: [{ type: "People", id: "LIST" }],
    }),

    register: build.mutation<AuthResult, RegisterRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
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
        setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
        api.dispatch(setUser(parsed.result.user))
        return { data: parsed.result }
      },
    }),

    login: build.mutation<AuthResult, LoginRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
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
        setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
        api.dispatch(setUser(parsed.result.user))
        return { data: parsed.result }
      },
    }),

    logout: build.mutation<{ message: string }, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: AUTH_PATHS.logout,
          method: "POST",
          body: {},
        })
        if (res.error) {
          console.error("Logout failed", res.error)
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          console.error(failMsg)
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseLogoutSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: { message: parsed.message } }
      },
    }),

    refreshToken: build.mutation<AuthResult, void>({
      async queryFn(_arg, api, extraOptions) {
        const rt = getRefreshToken()
        if (!rt) {
          return { error: { status: 401, data: "No refresh token" } }
        }
        logAuthRequestStart("refreshToken", AUTH_PATHS.refreshToken, "POST", {
          refreshToken: "[redacted]",
        })
        const res = await rawBaseQuery(
          {
            url: AUTH_PATHS.refreshToken,
            method: "POST",
            body: { refreshToken: rt },
          },
          api,
          extraOptions
        )
        if (res.error) {
          const normalized = normalizeFetchError(res.error)
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("refreshToken", "http", res.error, getErrorMessage(normalized))
          }
          return { error: normalized }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("refreshToken", "success-false", res.data, failMsg)
          }
          return { error: { status: 401, data: failMsg } }
        }
        logAuthResponseSuccess("refreshToken", res.data)
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          if (isAuthApiDebugEnabled()) {
            logAuthFailure("refreshToken", "parse", res.data, parsed.error)
          }
          return { error: { status: 422, data: parsed.error } }
        }
        logAuthResponseParsed("refreshToken", parsed.result)
        setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
        api.dispatch(setUser(parsed.result.user))
        return { data: parsed.result }
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

    addTransaction: build.mutation<Transaction, CreateTransactionPayload>({
      async queryFn(body) {
        await delay(150)
        const next: Transaction = {
          id: crypto.randomUUID(),
          title: body.title,
          amount: body.amount,
          type: body.type,
          date: body.date,
          category: body.category,
          accountId: body.accountId,
          accountName: body.accountName,
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
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetAccountsQuery,
  useGetPeopleQuery,
  useCreatePersonMutation,
  useGetTransactionsQuery,
  useAddTransactionMutation,
} = baseApi
