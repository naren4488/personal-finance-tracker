import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type {
  BaseQueryApi,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { ACCOUNT_PATHS, accountAdjustmentsPath } from "@/api/account-paths"
import { TRANSACTION_PATHS } from "@/api/transaction-paths"
import { AUTH_PATHS } from "@/api/auth-paths"
import { PEOPLE_PATHS } from "@/api/people-paths"
import { USER_PATHS } from "@/api/user-paths"
import { DASHBOARD_PATHS } from "@/api/dashboard-paths"
import { COMMITMENT_PATHS } from "@/api/commitment-paths"
import { isAccountCreateApiDisabled } from "@/lib/feature-flags"
import { BASE_URL } from "@/lib/env"
import { getRefreshToken, getToken, setAuthTokens } from "@/lib/auth/token"
import { isAccessTokenExpired } from "@/lib/auth/jwt"
import { signOutAndRedirectToLogin } from "@/lib/auth/sign-out-and-redirect"
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
  buildAccountBalanceAdjustmentPostBody,
  createAccountBalanceAdjustmentRequestSchema,
  parseCreateAccountBalanceAdjustmentSuccess,
  type AccountBalanceAdjustment,
  type CreateAccountBalanceAdjustmentRequest,
} from "@/lib/api/account-adjustment-schemas"
import {
  buildCreateAccountPostBody,
  parseCreateAccountSuccess,
  parseDeleteAccountApiSuccess,
  parseGetAccountsSuccess,
  type Account,
  type CreateAccountRequest,
  type CreateAccountResult,
} from "@/lib/api/account-schemas"
import { isCreditCardAccount } from "@/lib/api/credit-card-map"
import { isLoanAccount } from "@/lib/api/loan-account-map"
import {
  parseCreatePersonSuccess,
  parseGetPeopleSuccess,
  personSchema,
  type CreatePersonRequest,
  type Person,
} from "@/lib/api/people-schemas"
import {
  parseGetUdharAccountBalancesSuccess,
  type UdharAccountPersonBalance,
} from "@/lib/api/udhar-summary-schemas"
import {
  parseDashboardAnalyticsResponse,
  type DashboardAnalyticsView,
} from "@/lib/api/dashboard-analytics-schemas"
import {
  parseDashboardHomeResponse,
  type DashboardHomeView,
} from "@/lib/api/dashboard-home-schemas"
import {
  filterCommitmentsAfterAccountDelete,
  filterCommitmentsAfterPersonDelete,
  parseCreateCommitmentSuccess,
  parseGetCommitmentsSuccess,
  type Commitment,
  type CreateCommitmentRequest,
  type GetCommitmentsQueryArg,
} from "@/lib/api/commitment-schemas"
import { upsertCommitmentInListDraft } from "@/lib/commitments/commitment-cache"

const COMMITMENTS_LIST_CACHE_KEY = "LIST"

function refetchCommitmentsList(dispatch: (action: unknown) => void) {
  void dispatch(
    baseApi.endpoints.getCommitments.initiate({}, { subscribe: false, forceRefetch: true })
  )
}

export type DashboardAnalyticsQueryArg = {
  days: number
  /**
   * When true, sends `include_all=true` so the API aggregates every module (transactions, Udhar,
   * transfers, all account types). Backend must honor this flag.
   */
  includeAll?: boolean
  /** Server-side filter; sent as `search` query param when non-empty after trim. */
  search?: string
}

export type DashboardHomeQueryArg = {
  days?: number
  /** Sent as `recentLimit`; caps length of `recentTransactions` in the response. */
  recentLimit?: number
}

/** GET /transactions/recent — all filters combined in one request (query string). */
export type RecentTransactionsQueryArg = {
  limit?: number
  search?: string
  type?: "income" | "expense" | "transfer"
  direction?: "debit" | "credit"
  /** API format e.g. `1-04-2026` (day-month-year). */
  fromDate?: string
  toDate?: string
}

function buildRecentTransactionsParams(
  arg: RecentTransactionsQueryArg | undefined
): Record<string, string> {
  const params: Record<string, string> = {}
  const lim =
    arg && typeof arg.limit === "number" && Number.isFinite(arg.limit) && arg.limit > 0
      ? Math.min(5000, Math.max(1, Math.floor(arg.limit)))
      : 50
  params.limit = String(lim)
  if (arg?.search?.trim()) params.search = arg.search.trim()
  if (arg?.type) params.type = arg.type
  if (arg?.direction) params.direction = arg.direction
  if (arg?.fromDate?.trim()) params.fromDate = arg.fromDate.trim()
  if (arg?.toDate?.trim()) params.toDate = arg.toDate.trim()
  return params
}
import {
  buildTransactionPostBody,
  createTransactionApiBodySchema,
  mapApiTransactionToClient,
  parseCreateTransactionSuccess,
  parseGetRecentTransactionsSuccess,
  sanitizeApiRequestBody,
  applyAccountLedgerScopeToRecentTransactions,
  type CreateTransactionApiBody,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import {
  buildUdharEntryPostBody,
  createUdharEntryRequestSchema,
  parseCreateUdharEntrySuccess,
  type CreateUdharEntryRequest,
  type CreateUdharEntryResult,
} from "@/lib/api/udhar-schemas"
import { type CreateTransactionPayload, type Transaction } from "@/lib/api/schemas"
import { setUser } from "@/store/auth-slice"
import { addPerson, setPeople } from "@/store/people-slice"

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
  baseUrl: BASE_URL,
  prepareHeaders: (headers) => {
    const token = getToken() ?? ""
    headers.set("Authorization", `Bearer ${token}`)
    headers.set("Accept", "application/json")
    headers.set("Content-Type", "application/json")
    return headers
  },
})

function messageFromFetchError(error: FetchBaseQueryError | undefined): string | undefined {
  if (!error) return undefined
  const fromEnvelope = parseApiFailureMessage(error.data)
  if (fromEnvelope) return fromEnvelope
  if (typeof error.data === "string" && error.data.trim()) return error.data.trim()
  if (typeof error.data === "object" && error.data !== null) {
    const o = error.data as Record<string, unknown>
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim()
  }
  return undefined
}

let refreshInFlight: Promise<{ ok: true } | { ok: false; message?: string }> | null = null

function performTokenRefresh(
  api: BaseQueryApi
): Promise<{ ok: true } | { ok: false; message?: string }> {
  const rt = getRefreshToken()
  if (!rt) return Promise.resolve({ ok: false, message: "authorization token is required" })

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
        if (res.error) {
          return { ok: false, message: messageFromFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { ok: false, message: failMsg }
        }
        if (!tryApplyAuthResponse(res.data, api)) {
          return { ok: false, message: "Invalid refresh token response." }
        }
        return { ok: true }
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
  const accessToken = getToken()
  if (
    accessToken &&
    isAccessTokenExpired(accessToken) &&
    getRefreshToken() &&
    !isRefreshRequest(args) &&
    !isLogoutRequest(args)
  ) {
    const refresh = await performTokenRefresh(api)
    if (!refresh.ok) {
      signOutAndRedirectToLogin(api.dispatch, refresh.message)
      return {
        error: {
          status: 401,
          data: refresh.message ?? "authorization token is required",
        },
      }
    }
  }

  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status === 401 && !isRefreshRequest(args) && !isLogoutRequest(args)) {
    const refresh = await performTokenRefresh(api)
    if (refresh.ok) {
      result = await rawBaseQuery(args, api, extraOptions)
      if (result.error?.status === 401) {
        const msg = messageFromFetchError(result.error) ?? "authorization token is required"
        signOutAndRedirectToLogin(api.dispatch, msg)
      }
    } else {
      const msg =
        refresh.message ?? messageFromFetchError(result.error) ?? "authorization token is required"
      signOutAndRedirectToLogin(api.dispatch, msg)
    }
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Accounts",
    "Transactions",
    "Transaction",
    "People",
    "Account",
    "User",
    "UdharSummary",
    "PersonLedger",
    "DashboardAnalytics",
    "Dashboard",
    "Commitment",
  ],
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
      invalidatesTags: (result) => (result ? [{ type: "User", id: result.id }] : []),
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
      providesTags: ["Accounts", { type: "Account", id: "LIST" }],
    }),

    /** GET /accounts?kind=credit_card — same list endpoint, filtered for card UI. */
    getCreditCards: build.query<Account[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: ACCOUNT_PATHS.list,
          method: "GET",
          params: { kind: "credit_card" },
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
        const onlyCards = parsed.accounts.filter(isCreditCardAccount)
        if (import.meta.env.DEV && onlyCards.length === 0 && parsed.accounts.length > 0) {
          console.warn(
            "[getCreditCards] No accounts matched kind=credit_card in the API response; returning an empty list.",
            { returnedCount: parsed.accounts.length }
          )
        }
        return { data: onlyCards }
      },
      providesTags: ["Accounts", { type: "Account", id: "LIST" }],
    }),

    /** Strict credit card payment flow endpoint: GET /accounts?kind=credit_card */
    getCreditCardAccountsForPayment: build.query<Account[], void>({
      query: () => ({
        url: ACCOUNT_PATHS.list,
        method: "GET",
        params: { kind: "credit_card" },
      }),
      transformResponse: (response: unknown) => {
        const parsed = parseGetAccountsSuccess(response)
        return parsed.ok ? parsed.accounts : []
      },
      providesTags: ["Accounts", { type: "Account", id: "LIST" }],
    }),

    /** GET /accounts?kind=loan — same list endpoint, filtered for loan UI. */
    getLoans: build.query<Account[], void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: ACCOUNT_PATHS.list,
          method: "GET",
          params: { kind: "loan" },
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
        const onlyLoans = parsed.accounts.filter(isLoanAccount)
        if (import.meta.env.DEV && onlyLoans.length === 0 && parsed.accounts.length > 0) {
          console.warn(
            "[getLoans] No accounts matched kind=loan in the API response; returning an empty list.",
            { returnedCount: parsed.accounts.length }
          )
        }
        return { data: onlyLoans }
      },
      providesTags: ["Accounts", { type: "Account", id: "LIST" }],
    }),

    /** Strict EMI flow endpoint: GET /accounts?kind=loan */
    getLoanAccountsForEmi: build.query<Account[], void>({
      query: () => ({
        url: ACCOUNT_PATHS.list,
        method: "GET",
        params: { kind: "loan" },
      }),
      transformResponse: (response: unknown) => {
        const parsed = parseGetAccountsSuccess(response)
        return parsed.ok ? parsed.accounts : []
      },
      providesTags: ["Accounts", { type: "Account", id: "LIST" }],
    }),

    createAccount: build.mutation<CreateAccountResult, CreateAccountRequest>({
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
        return {
          data: {
            ...(parsed.account ? { account: parsed.account } : {}),
            ...(parsed.message ? { message: parsed.message } : {}),
          },
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "Dashboard", id: "HOME" },
        { type: "Account", id: "LIST" },
      ],
    }),

    updateAccount: build.mutation<
      CreateAccountResult,
      { id: string; body: Record<string, unknown> }
    >({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const id = arg.id.trim()
        if (!id) {
          return { error: { status: 422, data: "Account id is required" } }
        }
        const res = await baseQuery({
          url: `${ACCOUNT_PATHS.create}/${encodeURIComponent(id)}`,
          method: "PUT",
          body: arg.body,
        })
        if (res.error) {
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
        return {
          data: {
            ...(parsed.account ? { account: parsed.account } : {}),
            ...(parsed.message ? { message: parsed.message } : {}),
          },
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "Dashboard", id: "HOME" },
        { type: "Account", id: "LIST" },
      ],
    }),

    deleteAccount: build.mutation<{ message?: string }, string>({
      async queryFn(accountId, _api, _extraOptions, baseQuery) {
        const id = accountId.trim()
        if (!id) {
          return { error: { status: 422, data: "Account id is required" } }
        }
        const res = await baseQuery({
          url: `${ACCOUNT_PATHS.list}/${encodeURIComponent(id)}`,
          method: "DELETE",
          // Backend may support cascading deletion of account-linked transactions.
          params: { cascade: "true" },
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        if (res.data === undefined || res.data === null || res.data === "") {
          return { data: { message: "Deleted" } }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDeleteAccountApiSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 400, data: parsed.error } }
        }
        return { data: { message: parsed.message } }
      },
      async onQueryStarted(accountId, { dispatch, queryFulfilled }) {
        const id = accountId.trim()
        if (!id) return
        try {
          await queryFulfilled
          const stripDeleted = (accounts: Account[]) =>
            accounts.filter((a) => String(a.id).trim() !== id)
          dispatch(
            baseApi.util.updateQueryData("getAccounts", undefined, (draft) => stripDeleted(draft))
          )
          dispatch(
            baseApi.util.updateQueryData("getLoans", undefined, (draft) => stripDeleted(draft))
          )
          dispatch(
            baseApi.util.updateQueryData("getCreditCards", undefined, (draft) =>
              stripDeleted(draft)
            )
          )
          dispatch(
            baseApi.util.updateQueryData("getLoanAccountsForEmi", undefined, (draft) =>
              stripDeleted(draft)
            )
          )
          dispatch(
            baseApi.util.updateQueryData("getCreditCardAccountsForPayment", undefined, (draft) =>
              stripDeleted(draft)
            )
          )
          dispatch(
            baseApi.util.updateQueryData("getCommitments", {}, (draft) =>
              filterCommitmentsAfterAccountDelete(draft, id)
            )
          )
          refetchCommitmentsList(dispatch)
        } catch {
          // No-op: error handling remains in calling UI via `.unwrap()` branch.
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "PersonLedger" },
        { type: "Dashboard", id: "HOME" },
        "Transaction",
        { type: "Account", id: "LIST" },
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
        { type: "People", id: "LIST" },
        { type: "UdharSummary" },
        { type: "DashboardAnalytics", id: "LIST" },
        { type: "Commitment", id: "LIST" },
      ],
    }),

    createAccountBalanceAdjustment: build.mutation<
      { message?: string; adjustment?: AccountBalanceAdjustment },
      { accountId: string; body: CreateAccountBalanceAdjustmentRequest }
    >({
      async queryFn({ accountId, body }, _api, _extraOptions, baseQuery) {
        const id = accountId.trim()
        if (!id) {
          return { error: { status: 422, data: "Account id is required" } }
        }
        const validated = createAccountBalanceAdjustmentRequestSchema.safeParse(body)
        if (!validated.success) {
          const first = validated.error.flatten().formErrors[0]
          return { error: { status: 422, data: first ?? "Invalid adjustment data" } }
        }
        const postBody = buildAccountBalanceAdjustmentPostBody(validated.data)
        const res = await baseQuery({
          url: accountAdjustmentsPath(id),
          method: "POST",
          body: postBody,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseCreateAccountBalanceAdjustmentSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return {
          data: {
            ...(parsed.message ? { message: parsed.message } : {}),
            ...(parsed.adjustment ? { adjustment: parsed.adjustment } : {}),
          },
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "Dashboard", id: "HOME" },
        { type: "Account", id: "LIST" },
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
      ],
    }),

    deletePerson: build.mutation<{ message?: string }, string>({
      async queryFn(personId, _api, _extraOptions, baseQuery) {
        const id = personId.trim()
        if (!id) {
          return { error: { status: 422, data: "Person id is required" } }
        }
        const res = await baseQuery({
          url: `${PEOPLE_PATHS.list}/${encodeURIComponent(id)}`,
          method: "DELETE",
          // Backend may support cascading deletion of person-linked records.
          params: { cascade: "true" },
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        if (res.data === undefined || res.data === null || res.data === "") {
          return { data: { message: "Deleted" } }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDeleteAccountApiSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 400, data: parsed.error } }
        }
        return { data: { message: parsed.message } }
      },
      async onQueryStarted(personId, { dispatch, queryFulfilled }) {
        const id = personId.trim()
        if (!id) return
        try {
          await queryFulfilled
          dispatch(
            baseApi.util.updateQueryData("getCommitments", {}, (draft) =>
              filterCommitmentsAfterPersonDelete(draft, id)
            )
          )
          refetchCommitmentsList(dispatch)
        } catch {
          /* error surfaced in UI */
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "PersonLedger" },
        { type: "Dashboard", id: "HOME" },
        { type: "People", id: "LIST" },
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
        { type: "Account", id: "LIST" },
        { type: "UdharSummary" },
        { type: "DashboardAnalytics", id: "LIST" },
        { type: "Commitment", id: "LIST" },
      ],
    }),

    getPeople: build.query<Person[], { accountId?: string } | void>({
      async queryFn(arg, api, _extraOptions, baseQuery) {
        const accountId =
          arg && typeof arg === "object" && typeof arg.accountId === "string"
            ? arg.accountId.trim()
            : undefined
        const res = await baseQuery({
          url: PEOPLE_PATHS.list,
          method: "GET",
          params: accountId ? { accountId } : undefined,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 401, data: failMsg } }
        }
        const parsed = parseGetPeopleSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        const people = parsed.data.people
        if (!accountId) {
          api.dispatch(setPeople(people))
        }
        return { data: people }
      },
      providesTags: [{ type: "People", id: "LIST" }],
    }),

    getPersonLedger: build.query<RecentTransaction[], { personId: string; limit?: number }>({
      async queryFn({ personId, limit = 500 }, _api, _extraOptions, baseQuery) {
        const id = personId.trim()
        if (!id) {
          return { error: { status: 422, data: "Person id is required" } }
        }
        const lim =
          typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500
        const res = await baseQuery({
          url: TRANSACTION_PATHS.ledger,
          method: "GET",
          params: { personId: id, limit: String(lim) },
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
      providesTags: (_result, _error, arg) => [
        "Transactions",
        { type: "PersonLedger", id: arg.personId },
      ],
    }),

    getAccountLedger: build.query<RecentTransaction[], { accountId: string; limit?: number }>({
      async queryFn({ accountId, limit = 500 }, _api, _extraOptions, baseQuery) {
        const id = accountId.trim()
        if (!id) {
          return { error: { status: 422, data: "Account id is required" } }
        }
        const lim =
          typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500
        const res = await baseQuery({
          url: TRANSACTION_PATHS.ledger,
          method: "GET",
          params: { accountId: id, limit: String(lim) },
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
        return {
          data: applyAccountLedgerScopeToRecentTransactions(parsed.transactions, id),
        }
      },
      providesTags: ["Transactions"],
    }),

    getUdharAccountBalances: build.query<UdharAccountPersonBalance[], { accountId: string }>({
      async queryFn({ accountId }, _api, _extraOptions, baseQuery) {
        const id = accountId.trim()
        if (!id) {
          return { error: { status: 422, data: "Account id is required" } }
        }
        const res = await baseQuery({
          url: TRANSACTION_PATHS.udharSummary,
          method: "GET",
          params: { accountId: id },
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseGetUdharAccountBalancesSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.balances }
      },
      providesTags: [{ type: "UdharSummary" }],
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
      invalidatesTags: [
        { type: "People", id: "LIST" },
        { type: "UdharSummary" },
        { type: "PersonLedger" },
      ],
    }),

    register: build.mutation<AuthResult, RegisterRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: AUTH_PATHS.register,
          method: "POST",
          body,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
        api.dispatch(setUser(parsed.result.user))
        return { data: parsed.result }
      },
    }),

    login: build.mutation<AuthResult, LoginRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: AUTH_PATHS.login,
          method: "POST",
          body,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 401, data: failMsg } }
        }
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
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
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
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
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 401, data: failMsg } }
        }
        const parsed = parseAuthSuccessResponse(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        setAuthTokens(parsed.result.accessToken, parsed.result.refreshToken)
        api.dispatch(setUser(parsed.result.user))
        return { data: parsed.result }
      },
    }),

    getRecentTransactions: build.query<RecentTransaction[], RecentTransactionsQueryArg | void>({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const params = buildRecentTransactionsParams(
          arg && typeof arg === "object" ? arg : undefined
        )
        const res = await baseQuery({
          url: TRANSACTION_PATHS.recent,
          method: "GET",
          params,
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
      providesTags: ["Transactions", { type: "Transaction", id: "RECENT" }],
    }),

    /** Strict EMI flow endpoint: GET /transactions/recent */
    getRecentTransactionsForEmi: build.query<RecentTransaction[], void>({
      query: () => ({
        url: TRANSACTION_PATHS.recent,
        method: "GET",
      }),
      transformResponse: (response: unknown) => {
        const parsed = parseGetRecentTransactionsSuccess(response)
        return parsed.ok ? parsed.transactions : []
      },
      providesTags: ["Transactions", { type: "Transaction", id: "RECENT" }],
    }),

    getDashboard: build.query<DashboardHomeView, DashboardHomeQueryArg | void>({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const daysArg = arg && typeof arg === "object" ? arg.days : undefined
        const days =
          typeof daysArg === "number" && Number.isFinite(daysArg) && daysArg > 0
            ? Math.floor(daysArg)
            : 7
        const recentArg = arg && typeof arg === "object" ? arg.recentLimit : undefined
        const recentLimitRaw =
          typeof recentArg === "number" && Number.isFinite(recentArg) && recentArg > 0
            ? Math.floor(recentArg)
            : 5
        const recentLimit = Math.min(100, Math.max(1, recentLimitRaw))
        const res = await baseQuery({
          url: DASHBOARD_PATHS.root,
          method: "GET",
          params: { days: String(days), recentLimit: String(recentLimit) },
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDashboardHomeResponse(res.data, { horizonDays: days })
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.view }
      },
      providesTags: ["Dashboard", { type: "Dashboard", id: "HOME" }],
    }),

    getDashboardAnalytics: build.query<DashboardAnalyticsView, DashboardAnalyticsQueryArg>({
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const daysArg = arg?.days
        const includeAll = arg?.includeAll !== false
        const days =
          typeof daysArg === "number" && Number.isFinite(daysArg) && daysArg > 0
            ? Math.floor(daysArg)
            : 30
        const searchRaw = arg?.search
        const search =
          typeof searchRaw === "string" && searchRaw.trim() ? searchRaw.trim() : undefined
        const params: Record<string, string> = { days: String(days) }
        if (includeAll) params.include_all = "true"
        if (search) params.search = search
        const res = await baseQuery({
          url: DASHBOARD_PATHS.analytics,
          method: "GET",
          params,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDashboardAnalyticsResponse(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.view }
      },
      providesTags: ["Dashboard", { type: "DashboardAnalytics", id: "LIST" }],
    }),

    getCommitments: build.query<Commitment[], GetCommitmentsQueryArg | void>({
      serializeQueryArgs: () => COMMITMENTS_LIST_CACHE_KEY,
      keepUnusedDataFor: 0,
      async queryFn(arg, _api, _extraOptions, baseQuery) {
        const params: Record<string, string> = {}
        if (arg && typeof arg === "object") {
          if (arg.direction?.trim()) params.direction = arg.direction.trim()
          if (arg.status?.trim()) params.status = arg.status.trim()
        }
        const res = await baseQuery({
          url: COMMITMENT_PATHS.root,
          method: "GET",
          ...(Object.keys(params).length > 0 ? { params } : {}),
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseGetCommitmentsSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.commitments }
      },
      providesTags: [{ type: "Commitment", id: "LIST" }],
    }),

    createCommitment: build.mutation<Commitment, CreateCommitmentRequest>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        const res = await baseQuery({
          url: COMMITMENT_PATHS.root,
          method: "POST",
          body,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseCreateCommitmentSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        return { data: parsed.commitment }
      },
      invalidatesTags: [{ type: "Commitment", id: "LIST" }, "Dashboard", "DashboardAnalytics"],
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data: created } = await queryFulfilled
          dispatch(
            baseApi.util.updateQueryData("getCommitments", {}, (draft) => {
              upsertCommitmentInListDraft(draft, created)
            })
          )
          refetchCommitmentsList(dispatch)
        } catch {
          /* error surfaced in UI */
        }
      },
    }),

    /** Deletes any transaction by id; invalidates accounts + recent tx so balances and lists stay consistent. */
    deleteTransaction: build.mutation<{ message?: string }, string>({
      async queryFn(transactionId, _api, _extraOptions, baseQuery) {
        const id = transactionId.trim()
        if (!id) {
          return { error: { status: 422, data: "Transaction id is required" } }
        }
        const res = await baseQuery({
          url: `${TRANSACTION_PATHS.create}/${encodeURIComponent(id)}`,
          method: "DELETE",
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        if (res.data === undefined || res.data === null || res.data === "") {
          return { data: { message: "Deleted" } }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseDeleteAccountApiSuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 400, data: parsed.error } }
        }
        return { data: { message: parsed.message } }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "PersonLedger" },
        { type: "Dashboard", id: "HOME" },
        "Transaction",
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
        { type: "Account", id: "LIST" },
        { type: "UdharSummary" },
        { type: "People", id: "LIST" },
        { type: "DashboardAnalytics", id: "LIST" },
      ],
    }),

    addTransaction: build.mutation<Transaction, CreateTransactionPayload>({
      async queryFn(body, _api, _extraOptions, baseQuery) {
        let apiBody: CreateTransactionApiBody
        try {
          apiBody = buildTransactionPostBody(body)
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Invalid transaction payload"
          return { error: { status: 422, data: msg } }
        }

        const validated = createTransactionApiBodySchema.safeParse(apiBody)
        if (!validated.success) {
          return { error: { status: 422, data: "Invalid transaction payload" } }
        }

        const finalBody = sanitizeApiRequestBody(
          validated.data as unknown as Record<string, unknown>
        ) as CreateTransactionApiBody

        const res = await baseQuery({
          url: TRANSACTION_PATHS.create,
          method: "POST",
          body: finalBody,
        })

        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }

        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }

        const parsed = parseCreateTransactionSuccess(res.data)
        if (!parsed.ok) {
          const tx = mapApiTransactionToClient({}, body)
          return { data: tx }
        }

        const tx = mapApiTransactionToClient(parsed.transaction, body)
        return { data: tx }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "PersonLedger" },
        { type: "Dashboard", id: "HOME" },
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
        { type: "Account", id: "LIST" },
        { type: "UdharSummary" },
        { type: "DashboardAnalytics", id: "LIST" },
      ],
    }),

    createUdharEntry: build.mutation<CreateUdharEntryResult, CreateUdharEntryRequest>({
      async queryFn(body, api, _extraOptions, baseQuery) {
        const validated = createUdharEntryRequestSchema.safeParse(body)
        if (!validated.success) {
          const first = validated.error.flatten().formErrors[0]
          return { error: { status: 422, data: first ?? "Invalid udhar entry payload" } }
        }
        const postBody = buildUdharEntryPostBody(validated.data)
        const res = await baseQuery({
          url: TRANSACTION_PATHS.udhar,
          method: "POST",
          body: postBody,
        })
        if (res.error) {
          return { error: normalizeFetchError(res.error) }
        }
        const failMsg = parseApiFailureMessage(res.data)
        if (failMsg) {
          return { error: { status: 400, data: failMsg } }
        }
        const parsed = parseCreateUdharEntrySuccess(res.data)
        if (!parsed.ok) {
          return { error: { status: 422, data: parsed.error } }
        }
        if (parsed.entry?.person) {
          const personOk = personSchema.safeParse(parsed.entry.person)
          if (personOk.success) {
            api.dispatch(addPerson(personOk.data))
          }
        }
        const message =
          parsed.message?.trim() && parsed.message.trim().length > 0
            ? parsed.message.trim()
            : "udhar entry created successfully"
        return {
          data: {
            message,
            ...(parsed.entry ? { entry: parsed.entry } : {}),
          },
        }
      },
      invalidatesTags: [
        "Accounts",
        "Transactions",
        { type: "Dashboard", id: "HOME" },
        { type: "PersonLedger" },
        { type: "Transaction", id: "LIST" },
        { type: "Transaction", id: "RECENT" },
        { type: "People", id: "LIST" },
        { type: "Account", id: "LIST" },
        { type: "UdharSummary" },
        { type: "DashboardAnalytics", id: "LIST" },
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
  useGetCreditCardsQuery,
  useGetCreditCardAccountsForPaymentQuery,
  useGetLoansQuery,
  useGetLoanAccountsForEmiQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useCreateAccountBalanceAdjustmentMutation,
  useDeletePersonMutation,
  useGetPeopleQuery,
  useGetUdharAccountBalancesQuery,
  useLazyGetPersonLedgerQuery,
  useGetPersonLedgerQuery,
  useGetAccountLedgerQuery,
  useCreatePersonMutation,
  useGetRecentTransactionsQuery,
  useGetRecentTransactionsForEmiQuery,
  useGetDashboardQuery,
  useDeleteTransactionMutation,
  useAddTransactionMutation,
  useCreateUdharEntryMutation,
  useGetDashboardAnalyticsQuery,
  useGetCommitmentsQuery,
  useCreateCommitmentMutation,
  useGetMeQuery,
  useUpdateMeMutation,
  useDeleteMeMutation,
} = baseApi
