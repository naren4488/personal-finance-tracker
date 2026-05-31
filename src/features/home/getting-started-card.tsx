import type { LucideIcon } from "lucide-react"
import { Banknote, Landmark, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type GettingStartedCardProps = {
  onAddAccount: () => void
  onAddExpense: () => void
  onAddIncome: () => void
  className?: string
}

type StepConfig = {
  step: number
  title: string
  description: string
  actionLabel: string
  icon: LucideIcon
  onAction: () => void
}

export function GettingStartedCard({
  onAddAccount,
  onAddExpense,
  onAddIncome,
  className,
}: GettingStartedCardProps) {
  const steps: StepConfig[] = [
    {
      step: 1,
      title: "Add your first account",
      description: "Cash, bank, wallet, UPI, and more.",
      actionLabel: "Add account",
      icon: Landmark,
      onAction: onAddAccount,
    },
    {
      step: 2,
      title: "Record your first expense",
      description: "Start tracking where your money goes.",
      actionLabel: "Add expense",
      icon: Banknote,
      onAction: onAddExpense,
    },
    {
      step: 3,
      title: "Add your first income entry",
      description: "Log salary and other income in Entries.",
      actionLabel: "Add income",
      icon: TrendingUp,
      onAction: onAddIncome,
    },
  ]

  return (
    <Card className={cn("rounded-2xl border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-bold text-foreground">Getting started</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          A quick checklist to set up Koin. Your progress updates as you add data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {steps.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.step}
              className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  aria-hidden
                >
                  {item.step}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-9 w-full shrink-0 rounded-xl sm:w-auto"
                onClick={item.onAction}
              >
                {item.actionLabel}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
