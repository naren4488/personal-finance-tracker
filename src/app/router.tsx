import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { PageLoader } from "@/components/page-loader"
import { RouteErrorFallback } from "@/components/route-error-fallback"
import { RequireAuth } from "@/features/auth/require-auth"

const HomePage = lazy(() => import("@/pages/home-page"))
const EntriesPage = lazy(() => import("@/pages/entries-page"))
const AccountsPage = lazy(() => import("@/pages/accounts-page"))
const AnalyticsPage = lazy(() => import("@/pages/analytics-page"))
const LoginPage = lazy(() => import("@/pages/login-page"))
const RegisterPage = lazy(() => import("@/pages/register-page"))

const suspense = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>

export const router = createBrowserRouter([
  {
    path: "/login",
    element: suspense(<LoginPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/register",
    element: suspense(<RegisterPage />),
    errorElement: <RouteErrorFallback />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: suspense(<HomePage />) },
      { path: "entries", element: suspense(<EntriesPage />) },
      { path: "accounts", element: suspense(<AccountsPage />) },
      { path: "analytics", element: suspense(<AnalyticsPage />) },
    ],
  },
])
