import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RouteErrorFallback() {
  const error = useRouteError()
  const navigate = useNavigate()

  let title = "Something went wrong"
  let description = "An error occurred while loading this route."
  let details: string | null = null

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`.trim()
    description = typeof error.data === "string" ? error.data : "Route error"
    details = error.statusText || null
  } else if (error instanceof Error) {
    details = error.message
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {details && (
          <CardContent>
            <p className="rounded-xl bg-muted/50 p-3 font-mono text-xs text-muted-foreground break-all">
              {details}
            </p>
          </CardContent>
        )}
        <CardFooter className="gap-2">
          <Button type="button" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/", { replace: true })}
          >
            Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
