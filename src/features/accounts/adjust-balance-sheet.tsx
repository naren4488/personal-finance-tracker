import { useCallback, useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Scale, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import {
  accountAvailableBalanceInrFromApi,
  formatOpeningBalanceForApi,
} from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { getToken } from "@/lib/auth/token"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCreateAccountBalanceAdjustmentMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isAuthTokenRequiredMessage(message: string): boolean {
  return message.toLowerCase().includes("authorization token is required")
}

function parseAmountToNumber(s: string): number | null {
  const t = s.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const fieldClass =
  "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

type FormState = {
  targetBalance: string
  date: string
  reason: string
  note: string
}

function initialFormForAccount(account: Account): FormState {
  const current = accountAvailableBalanceInrFromApi(account)
  return {
    targetBalance: formatOpeningBalanceForApi(current),
    date: todayIsoDate(),
    reason: "",
    note: "",
  }
}

type MountedProps = {
  open: boolean
  account: Account
  onOpenChange: (open: boolean) => void
}

function AdjustBalanceSheetMounted({ open, account, onOpenChange }: MountedProps) {
  const titleId = useId()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [form, setForm] = useState<FormState>(() => initialFormForAccount(account))
  const [adjust, { isLoading }] = useCreateAccountBalanceAdjustmentMutation()

  const accountName = account.name?.trim() || "Account"
  const currentBalanceInr = accountAvailableBalanceInrFromApi(account)

  useEffect(() => {
    setForm(initialFormForAccount(account))
  }, [account])

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!getToken()) {
      toast.error("Please sign in again")
      endUserSession(dispatch)
      navigate("/login", { replace: true })
      dismiss()
      return
    }

    const n = parseAmountToNumber(form.targetBalance)
    if (n === null) {
      toast.error("Enter a valid target balance")
      return
    }

    const reason = form.reason.trim()
    if (!reason) {
      toast.error("Reason is required")
      return
    }

    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Missing account id")
      return
    }

    try {
      const result = await adjust({
        accountId,
        body: {
          targetCurrentBalance: formatOpeningBalanceForApi(n),
          date: form.date.trim(),
          reason,
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        },
      }).unwrap()

      const msg =
        result.message?.trim() && result.message.trim().length > 0
          ? result.message.trim()
          : "Balance adjustment saved"
      toast.success(msg)
      dismiss()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (isAuthTokenRequiredMessage(msg)) {
        toast.error("Please sign in again")
        endUserSession(dispatch)
        navigate("/login", { replace: true })
        dismiss()
        return
      }
      toast.error(msg)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      header={
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <DialogTitle asChild>
              <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
                Adjust balance
              </h2>
            </DialogTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{accountName}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="size-5" strokeWidth={2} />
          </Button>
        </header>
      }
      formProps={{ onSubmit: (e) => void handleSubmit(e) }}
      footer={
        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
        >
          {isLoading ? "Saving…" : "Save adjustment"}
        </Button>
      }
    >
      <div className="space-y-3 px-4 py-2">
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5">
          <Scale className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">Current balance (reference)</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(currentBalanceInr)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the balance that should match your bank statement. The server applies the
              difference — you do not enter the adjustment amount here.
            </p>
          </div>
        </div>

        <section>
          <Label htmlFor="adj-target" className="mb-0.5 block text-xs font-bold text-primary">
            Target balance
          </Label>
          <Input
            id="adj-target"
            inputMode="decimal"
            autoComplete="off"
            value={form.targetBalance}
            onChange={(e) => setForm((f) => ({ ...f, targetBalance: e.target.value }))}
            className={cn(fieldClass, "h-10")}
            placeholder="0.00"
          />
        </section>

        <section>
          <Label htmlFor="adj-date" className="mb-0.5 block text-xs font-bold text-primary">
            Date
          </Label>
          <Input
            id="adj-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className={cn(fieldClass, "h-10 scheme-light dark:scheme-dark")}
          />
        </section>

        <section>
          <Label htmlFor="adj-reason" className="mb-0.5 block text-xs font-bold text-primary">
            Reason
          </Label>
          <Input
            id="adj-reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className={cn(fieldClass, "h-10")}
            placeholder="e.g. reconciled with bank statement"
            autoComplete="off"
          />
        </section>

        <section>
          <Label htmlFor="adj-note" className="mb-0.5 block text-xs font-bold text-primary">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="adj-note"
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={cn(
              "min-h-9 w-full resize-none rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm outline-none",
              "placeholder:text-muted-foreground/80",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
            placeholder="Optional details"
          />
        </section>
      </div>
    </FormDialog>
  )
}

export type AdjustBalanceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

/** Renders only while open so form state resets when closed. */
export function AdjustBalanceSheet({ open, onOpenChange, account }: AdjustBalanceSheetProps) {
  if (!open || !account) return null
  return <AdjustBalanceSheetMounted open={open} account={account} onOpenChange={onOpenChange} />
}
