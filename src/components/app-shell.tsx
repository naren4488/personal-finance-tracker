import { Suspense } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { BarChart3, Home, LayoutGrid, Plus, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderProfileMenu } from "@/components/header-profile-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { ErrorBoundary } from "@/components/error-boundary"
import { PageLoader } from "@/components/page-loader"
import { cn } from "@/lib/utils"
import {
  ENTRIES_ADD_SEARCH_PARAM,
  ENTRIES_FAB_OPEN_EVENT,
  getLastEntriesSegmentForFab,
} from "@/features/entries/entries-fab"

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/entries", label: "Entries", icon: LayoutGrid, end: false },
  { to: "/accounts", label: "Accounts", icon: Wallet, end: false },
  { to: "/analytics", label: "Analytics", icon: BarChart3, end: false },
] as const

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showFab =
    pathname !== "/analytics" &&
    pathname !== "/accounts" &&
    pathname !== "/profile" &&
    !pathname.startsWith("/transactions/")

  function handleFabClick() {
    if (pathname === "/entries") {
      window.dispatchEvent(new CustomEvent(ENTRIES_FAB_OPEN_EVENT))
      return
    }
    const tab = getLastEntriesSegmentForFab()
    navigate(`/entries?${ENTRIES_ADD_SEARCH_PARAM}=${encodeURIComponent(tab)}`)
  }

  return (
    <div className="relative mx-auto flex h-dvh min-h-0 max-w-lg flex-col overflow-hidden bg-background">
      <header className="shrink-0 z-40 rounded-b-2xl bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-primary-foreground hover:opacity-90"
          >
            Koin
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <HeaderProfileMenu />
          </div>
        </div>
      </header>

      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </div>
        </Suspense>
      </ErrorBoundary>

      {showFab && (
        <Button
          type="button"
          size="icon"
          className="fixed bottom-20 right-4 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Add entry"
          onClick={handleFabClick}
        >
          <Plus className="size-6" strokeWidth={2} />
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
