import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render errors in subtree. Pair with React Router `errorElement` for loader/action errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="flex min-h-[50dvh] items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-2xl border-destructive/30 shadow-lg">
            <CardHeader>
              <CardTitle className="text-destructive">Something broke</CardTitle>
              <CardDescription>
                This section hit an unexpected error. You can try again or reload the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-xl bg-muted/50 p-3 font-mono text-xs text-muted-foreground break-all">
                {this.state.error.message}
              </p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" onClick={() => this.setState({ hasError: false, error: null })}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
