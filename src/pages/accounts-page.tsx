import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AccountsPage() {
  return (
    <main className="px-4 py-4 pb-24">
      <Card className="rounded-2xl border-dashed shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Accounts</CardTitle>
          <CardDescription>Bank, cash, and UPI profiles will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Connect RTK Query endpoints when your API is ready.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
