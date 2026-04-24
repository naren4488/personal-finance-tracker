import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Account } from "@/lib/api/account-schemas"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import {
  PersonUdharAvatarTitle,
  PersonUdharLedgerList,
  PersonUdharNetAndQuadrants,
} from "@/features/accounts/person-udhar-panels"

export function UdharDetailsModal({
  open,
  onOpenChange,
  personName,
  entries,
  listTotalBalance,
  accounts,
  onDeleteEntry,
  onOpenUdharEntry,
  onAddExpenseOnBehalf,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  entries: RecentTransaction[]
  /** Signed net from People list (`totalBalance`); matches person detail when set. */
  listTotalBalance?: number
  accounts?: Account[]
  onDeleteEntry?: (tx: RecentTransaction) => void
  /** Opens the shared Add Udhar sheet with this entry type (Give / Take / Record payment). */
  onOpenUdharEntry: (preset: { entryType: UdharEntryType }) => void
  /** Optional: e.g. navigate to add expense with account context. */
  onAddExpenseOnBehalf?: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={() => onOpenChange(false)}
        aria-label="Close details"
      />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        role="dialog"
        aria-label={`Udhar — ${personName}`}
      >
        <div className="shrink-0 space-y-4 border-b border-border/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <PersonUdharAvatarTitle personName={personName} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="size-5" />
            </Button>
          </div>

          <PersonUdharNetAndQuadrants entries={entries} listTotalBalance={listTotalBalance} />

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 rounded-xl bg-[#071f78] font-semibold text-white hover:bg-[#071f78]/90"
                onClick={() => onOpenUdharEntry({ entryType: "money_given" })}
              >
                Give
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border font-semibold"
                onClick={() => onOpenUdharEntry({ entryType: "money_taken" })}
              >
                Take
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border text-sm font-semibold sm:text-base"
                onClick={() => onOpenUdharEntry({ entryType: "payment_received" })}
              >
                Record received
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-border text-sm font-semibold sm:text-base"
                onClick={() => onOpenUdharEntry({ entryType: "payment_made" })}
              >
                Record paid
              </Button>
            </div>
            {onAddExpenseOnBehalf ? (
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-xl bg-muted/80 font-semibold text-foreground hover:bg-muted"
                onClick={onAddExpenseOnBehalf}
              >
                <span className="mr-2 inline-flex" aria-hidden>
                  💸
                </span>
                Add Expense On Their Behalf
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 px-2 pb-2 pt-3 sm:px-3">
          <h3 className="shrink-0 px-1 pb-2 text-base font-bold text-foreground">Full Ledger</h3>
          <PersonUdharLedgerList
            entries={entries}
            accounts={accounts}
            onDeleteEntry={onDeleteEntry}
            listClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:thin]"
          />
        </div>
      </div>
    </div>
  )
}
