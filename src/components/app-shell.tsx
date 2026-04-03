import { Suspense } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { BarChart3, Home, LayoutGrid, LogOut, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ErrorBoundary } from "@/components/error-boundary"
import { PageLoader } from "@/components/page-loader"
import { cn } from "@/lib/utils"
import { clearToken } from "@/lib/auth/token"

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/entries", label: "Entries", icon: LayoutGrid, end: false },
  { to: "/accounts", label: "Accounts", icon: Wallet, end: false },
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
] as const

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showFab = pathname !== "/analytics" && pathname !== "/accounts"

  function handleLogout() {
    clearToken()
    navigate("/login", { replace: true })
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col bg-background">
      <header className="sticky top-0 z-40 rounded-b-2xl bg-primary px-4 py-3 text-primary-foreground transition-transform duration-300">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Wallet className="size-8 text-primary-foreground" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight">Koin</h1>
              <p className="truncate text-sm text-primary-foreground/80">
                Your personal finance companion
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label="Log out"
              onClick={handleLogout}
            >
              <LogOut className="size-5" strokeWidth={1.5} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>

      {showFab && (
        <Button
          size="icon"
          className="fixed bottom-20 right-4 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          asChild
        >
          <Link to="/entries" aria-label="Add transaction">
            <Plus className="size-6" strokeWidth={2} />
          </Link>
        </Button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all",
                  "text-muted-foreground hover:text-foreground",
                  isActive && "text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn("size-5", isActive && "scale-105")}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
