import type { ReactNode } from "react"
import { Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthModeToggle } from "@/features/auth/auth-mode-toggle"

type Mode = "login" | "register"

export function AuthLayout({ mode, children }: { mode: Mode; children: ReactNode }) {
  const isRegister = mode === "register"

  return (
    <div className="relative min-h-dvh bg-muted/40 dark:bg-background">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle className="border border-border/80 bg-card text-foreground hover:bg-muted hover:text-foreground" />
      </div>
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-md"
            aria-hidden
          >
            <Wallet className="size-8 text-primary-foreground" strokeWidth={2} />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Koin</h1>
          <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
            Your personal finance companion
          </p>
        </div>

        <Card className="w-full max-w-[400px] border-border/60 shadow-lg shadow-black/[0.06] dark:shadow-black/25">
          <CardHeader className="space-y-1 border-b border-border/50 pb-4">
            <CardTitle className="text-xl font-semibold">
              {isRegister ? "Sign up" : "Log in"}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? "Create an account to track your finances."
                : "Enter your email and password to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AuthModeToggle mode={mode} />
            <div className="mt-6">{children}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
