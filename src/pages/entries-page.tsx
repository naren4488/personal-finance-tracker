import { QuickTransactionForm } from "@/features/entries/quick-transaction-form"

export default function EntriesPage() {
  return (
    <main className="space-y-4 px-4 py-4 pb-24">
      <div>
        <h2 className="text-sm font-semibold">Entries</h2>
        <p className="text-xs text-muted-foreground">Manage transactions and categories.</p>
      </div>
      <QuickTransactionForm />
    </main>
  )
}
