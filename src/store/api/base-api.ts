import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { ACCOUNT_PATHS } from "@/api/account-paths"
import { TRANSACTION_PATHS } from "@/api/transaction-paths"
import { AUTH_PATHS } from "@/api/auth-paths"
import { PEOPLE_PATHS } from "@/api/people-paths"
import { USER_PATHS } from "@/api/user-paths"
import { isAccountCreateApiDisabled } from "@/lib/feature-flags"
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
import {
  parseDeleteAccountSuccess,
  parseProfileSuccessEnvelope,
  updateProfileRequestSchema,
  type ProfileUser,
  type UpdateProfileRequest,
} from "@/lib/api/profile-schemas"
import {
  buildCreateAccountPostBody,
  parseCreateAccountSuccess,
  parseGetAccountsSuccess,
  type Account,
  type CreateAccountRequest,
} from "@/lib/api/account-schemas"
import {
  parseCreatePersonSuccess,
  parseGetPeopleSuccess,
  type CreatePersonRequest,
  type Person,
} from "@/lib/api/people-schemas"
import {
  mapApiTransactionToClient,
  parseCreateTransactionSuccess,
  parseGetRecentTransactionsSuccess,
  payloadToApiBody,
  createTransactionApiBodySchema,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { type CreateTransactionPayload, type Transaction } from "@/lib/api/schemas"
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
import { clearAllProfileDraftsFromStorage } from "@/lib/profile/local-profile-draft"
import { clearUser, setUser } from "@/store/auth-slice"
import { addPerson, resetPeople, setPeople } from "@/store/people-slice"

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
    headers.set("Accept", "application/json")
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
      clearAllProfileDraftsFromStorage()
      clearToken()
      api.dispatch(clearUser())
      api.dispatch(baseApi.util.resetApiState())
      api.dispatch(resetPeople())
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Transaction", "People", "Account", "User"],
  endpoints: (build) => ({
    getMe: build.query<ProfileUser, string>({
      async queryFn(userId, _api, _extraOptions, baseQuery) {
        void userId
        const res = await baseQuery({
          url: USER_PATHS.me,
          method: "GET",
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseProfileSuccessEnvelope(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.user }
      },
      providesTags: (_result, _error, userId) => [{ type: "User", id: userId }],
    }),

    updateMe: build.mutation<ProfileUser, UpdateProfileRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        const validated = updateProfileRequestSchema.safeParse(body)
        if (!validated.success) {
          const first = validated.error.flatten().formErrors[0]
          return { error: { status: 422, data: first ?? "Invalid profile data" } }
        }
        const res = await baseQuery({
          url: USER_PATHS.me,
          method: "PUT",
          body: validated.data,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseProfileSuccessEnvelope(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.user }
      },
      invalidatesTags: ["User"],
    }),

    deleteMe: build.mutation<{ message: string }, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: USER_PATHS.me,
          method: "DELETE",
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDeleteAccountSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: { message: parsed.message } }
      },
      // Like `logout`: no tag invalidation. Invalidation can error during teardown and
      // `endUserSession` already calls `resetApiState()`.
    }),

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

    createAccount: build.mutation<Account, CreateAccountRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        if (isAccountCreateApiDisabled()) {
          return {
            error: {
              status: 503,
              data: "Adding accounts isn’t available yet. Remove VITE_DISABLE_ACCOUNT_CREATE when the API is ready.",
            },
          }
        }
        const postBody = buildCreateAccountPostBody(body)
        const res = await baseQuery({
          url: ACCOUNT_PATHS.create,
          method: "POST",
          body: postBody,
        })
        if (res.error) {
          const fe = res.error as { status?: unknown; data?: unknown }
          if (import.meta.env.DEV) {
            console.error("[accounts] create failed HTTP status:", fe.status)
            console.error(
              "[accounts] create failed response body:",
              JSON.stringify(fe.data, null, 2)
            )
            console.error("[accounts] create request body sent:", JSON.stringify(postBody, null, 2))
          }
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseCreateAccountSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.account }
      },
      invalidatesTags: [{ type: "Account", id: "LIST" }],
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

    getRecentTransactions: build.query<RecentTransaction[], number | undefined>({
      async queryFn(limitArg, _api, _extraOptions, baseQuery) {
        const limit =
          typeof limitArg === "number" && Number.isFinite(limitArg) && limitArg > 0
            ? Math.min(Math.floor(limitArg), 200)
            : 50
        const res = await baseQuery({
          url: TRANSACTION_PATHS.recent,
          method: "GET",
          params: { limit: String(limit) },
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseGetRecentTransactionsSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.transactions }
      },
      providesTags: [{ type: "Transaction", id: "RECENT" }],
    }),

    addTransaction: build.mutation<Transaction, CreateTransactionPayload>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        const apiBody = payloadToApiBody(body)
        const validated = createTransactionApiBodySchema.safeParse(apiBody)
        if (!validated.success) {
          console.error("[transactions] invalid payload", validated.error.flatten(), apiBody)
          return { error: { status: 422, data: "Invalid transaction payload" } }
        }

        const res = await baseQuery({
          url: TRANSACTION_PATHS.create,
          method: "POST",
          body: validated.data,
        })

        if (res.error) {
          const err = normalizeFetchError(res.error)
          console.error("[transactions] request failed", err)
          return { error: err }
        }

        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          console.error("[transactions] API error envelope", failMsg, res.data)
          return { error: { status: 400, data: failMsg } }
        }

        const parsed = parseCreateTransactionSuccess(res.data)
        if (!parsed.ok) {
          console.warn(
            "[transactions] unexpected success shape, using fallback client row",
            parsed.error,
            res.data
          )
          const tx = mapApiTransactionToClient({}, body)
          mockTransactions.unshift(tx)
          console.log("[transactions] created (fallback)", tx)
          return { data: tx }
        }

        const tx = mapApiTransactionToClient(parsed.transaction, body)
        mockTransactions.unshift(tx)
        console.log("[transactions] created OK", res.data, tx)
        return { data: tx }
      },
      invalidatesTags: [
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
      ],
    }),
  }),
})

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetAccountsQuery,
  useCreateAccountMutation,
  useGetPeopleQuery,
  useCreatePersonMutation,
  useGetRecentTransactionsQuery,
  useAddTransactionMutation,
  useGetMeQuery,
  useUpdateMeMutation,
  useDeleteMeMutation,
} = baseApi
