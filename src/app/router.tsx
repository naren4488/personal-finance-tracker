import { lazy } from "react"
import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { RouteErrorFallback } from "@/components/route-error-fallback"

const HomePage = lazy(() => import("@/pages/home-page"))
const EntriesPage = lazy(() => import("@/pages/entries-page"))
const AccountsPage = lazy(() => import("@/pages/accounts-page"))
const AnalyticsPage = lazy(() => import("@/pages/analytics-page"))

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "entries", element: <EntriesPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
    ],
  },
])
