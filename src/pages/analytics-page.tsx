import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AnalyticsPage() {
  return (
    <main className="px-4 py-4 pb-24">
      <Card className="rounded-2xl border-dashed shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Analytics</CardTitle>
          <CardDescription>Charts and trends (e.g. Recharts) can plug in here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Keep heavy chart libraries lazy-loaded for performance.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
