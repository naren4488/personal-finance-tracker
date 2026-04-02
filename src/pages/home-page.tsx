import { memo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/format"
import { getErrorMessage } from "@/lib/api/errors"
import type { Transaction } from "@/lib/api/schemas"
import { useGetTransactionsQuery } from "@/store/api/base-api"

const TransactionRow = memo(function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === "income"
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-2">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${isIncome ? "bg-income/15" : "bg-expense/15"}`}
        >
          {isIncome ? (
            <TrendingUp className="size-3.5 text-income" strokeWidth={2} />
          ) : (
            <TrendingDown className="size-3.5 text-expense" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{tx.title}</p>
          <p className="truncate text-[10px] text-muted-foreground">{formatDate(tx.date)}</p>
        </div>
      </div>
      <span
        className={`shrink-0 text-sm font-bold tabular-nums ${isIncome ? "text-income" : "text-expense"}`}
      >
        {isIncome ? "+" : "−"}
        {formatCurrency(tx.amount)}
      </span>
    </div>
  )
})

export default function HomePage() {
  const { data: transactions, isLoading, isError, error, refetch } = useGetTransactionsQuery()

  const totalBalance =
    transactions?.reduce((acc, tx) => acc + (tx.type === "income" ? tx.amount : -tx.amount), 0) ?? 0
  const income =
    transactions?.filter((t) => t.type === "income").reduce((acc, t) => acc + t.amount, 0) ?? 0
  const expenses =
    transactions?.filter((t) => t.type === "expense").reduce((acc, t) => acc + t.amount, 0) ?? 0

  return (
    <main className="flex-1 space-y-4 px-4 py-4 pb-24">
      <Card className="rounded-2xl border-0 bg-primary py-5 text-primary-foreground shadow-xl ring-0">
        <CardHeader className="px-5 pb-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary-foreground/70">
            Total balance
          </p>
          <CardTitle className="text-3xl font-bold tabular-nums text-primary-foreground">
            {isLoading ? (
              <Skeleton className="h-9 w-40 bg-primary-foreground/20" />
            ) : (
              formatCurrency(totalBalance)
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-foreground/10 px-3 py-2">
              <p className="text-[10px] font-medium text-primary-foreground/70">Income</p>
              <p className="text-sm font-semibold tabular-nums">
                {isLoading ? "…" : formatCurrency(income)}
              </p>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 px-3 py-2">
              <p className="text-[10px] font-medium text-primary-foreground/70">Expenses</p>
              <p className="text-sm font-semibold tabular-nums">
                {isLoading ? "…" : formatCurrency(expenses)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent</h2>
        {isError && (
          <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-xl"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}
        {isLoading && !isError && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        )}
        {!isLoading &&
          !isError &&
          transactions?.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "90d"] as const).map((preset) => (
            <Badge
              key={preset}
              variant="secondary"
              className="rounded-lg px-3 py-1 text-[10px] font-medium"
            >
              {preset}
            </Badge>
          ))}
        </div>
      </section>

      <Card className="glass-card rounded-2xl border-border/50 py-4 shadow-lg ring-0">
        <CardHeader>
          <CardTitle className="text-sm">Glass card</CardTitle>
          <CardDescription>
            Utility class{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">glass-card</code> from the
            design system.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Delete</Button>
      </div>
    </main>
  )
}
