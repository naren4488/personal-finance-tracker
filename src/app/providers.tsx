import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { store } from "@/store"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </Provider>
  )
}
