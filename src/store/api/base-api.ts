import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { getApiBaseUrl } from "@/lib/env"
import {
  transactionListSchema,
  transactionSchema,
  type QuickTransactionPayload,
  type Transaction,
} from "@/lib/api/schemas"
import { mockTransactions } from "@/lib/api/mock-transactions"

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: (headers) => {
      return headers
    },
  }),
  tagTypes: ["Transaction"],
  endpoints: (build) => ({
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

export const { useGetTransactionsQuery, useAddTransactionMutation } = baseApi
