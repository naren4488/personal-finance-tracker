import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { store } from "@/store"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { SessionRestore } from "@/features/auth/session-restore"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <SessionRestore>{children}</SessionRestore>
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </Provider>
  )
}
