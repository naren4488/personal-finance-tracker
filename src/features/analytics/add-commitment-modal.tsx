import { useCallback, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import { buildCreateCommitmentBody } from "@/lib/api/commitment-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { cn } from "@/lib/utils"
import { useCreateCommitmentMutation, useGetCreditCardsQuery } from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const DIRECTIONS = [
  { value: "payable" as const, label: "payable" },
  { value: "receivable" as const, label: "receivable" },
]

const KINDS = [
  { value: "card_bill" as const, label: "card_bill" },
  { value: "loan" as const, label: "loan" },
  { value: "other" as const, label: "other" },
]

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddCommitmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  direction: (typeof DIRECTIONS)[number]["value"]
  kind: (typeof KINDS)[number]["value"]
  title: string
  amount: string
  dueDate: string
  cardAccountId: string
  note: string
}

function initialForm(): FormState {
  return {
    direction: "payable",
    kind: "card_bill",
    title: "",
    amount: "",
    dueDate: todayIsoDate(),
    cardAccountId: "",
    note: "",
  }
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddCommitmentModalMounted({ open, onOpenChange }: MountedProps) {
  const titleId = useId()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [createCommitment, { isLoading: isCreating }] = useCreateCommitmentMutation()
  const {
    data: cardsRaw = [],
    isLoading: cardsLoading,
    isFetching: cardsFetching,
  } = useGetCreditCardsQuery(undefined, { skip: !user })
  const cards = useMemo(() => filterActiveAccounts(cardsRaw), [cardsRaw])
  const cardsBusy = cardsLoading || cardsFetching

  const [form, setForm] = useState(() => initialForm())

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const fieldClass =
    "h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-[#1e1b4b]/40 focus-visible:ring-2 focus-visible:ring-[#1e1b4b]/20"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) {
      toast.error("Enter a title")
      return
    }
    const n = form.amount.replace(/[^\d.]/g, "")
    const amountNum = Number(n)
    if (!n || !Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.dueDate) {
      toast.error("Select due date")
      return
    }
    if (form.kind === "card_bill" && !form.cardAccountId) {
      toast.error("Select a card")
      return
    }

    let body
    try {
      body = buildCreateCommitmentBody({
        direction: form.direction,
        kind: form.kind,
        title,
        amountInput: form.amount,
        dueDate: form.dueDate,
        status: "pending",
        accountId: form.kind === "card_bill" ? form.cardAccountId : undefined,
        note: form.note,
      })
    } catch {
      toast.error("Enter a valid amount")
      return
    }

    try {
      await createCommitment(body).unwrap()
      toast.success("Commitment saved")
      setForm(initialForm())
      dismiss()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/authorization token is required/i.test(msg)) {
        toast.error("Please sign in again")
        endUserSession(dispatch)
        dismiss()
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Commitment"
      header={
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-[#0f172a]">
            Add Commitment
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-slate-500 hover:text-slate-900"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="size-5" strokeWidth={2} />
          </Button>
        </header>
      }
      formProps={{ onSubmit: (e) => void handleSubmit(e) }}
      footer={
        <div className="flex justify-start">
          <Button
            type="submit"
            disabled={isCreating}
            className="h-10 rounded-xl bg-[#1e1b4b] px-6 text-sm font-bold text-white hover:bg-[#16143a] disabled:opacity-60"
          >
            {isCreating ? "Saving…" : "Save Commitment"}
          </Button>
        </div>
      }
    >
      <div className="px-5 pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="commitment-direction" className="text-xs font-medium text-slate-600">
              Direction
            </Label>
            <div className="relative">
              <select
                id="commitment-direction"
                value={form.direction}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    direction: e.target.value as FormState["direction"],
                  }))
                }
                className={cn(fieldClass, "appearance-none pr-9")}
              >
                {DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-kind" className="text-xs font-medium text-slate-600">
              Kind
            </Label>
            <div className="relative">
              <select
                id="commitment-kind"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as FormState["kind"],
                  }))
                }
                className={cn(fieldClass, "appearance-none pr-9")}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-title" className="text-xs font-medium text-slate-600">
              Title
            </Label>
            <Input
              id="commitment-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={fieldClass}
              placeholder=""
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-amount" className="text-xs font-medium text-slate-600">
              Amount
            </Label>
            <Input
              id="commitment-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={fieldClass}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-due" className="text-xs font-medium text-slate-600">
              Due Date
            </Label>
            <Input
              id="commitment-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className={cn(fieldClass, "scheme-light")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commitment-card" className="text-xs font-medium text-slate-600">
              Card
            </Label>
            <div className="relative">
              <select
                id="commitment-card"
                value={form.cardAccountId}
                onChange={(e) => setForm((f) => ({ ...f, cardAccountId: e.target.value }))}
                disabled={cardsBusy}
                className={cn(
                  fieldClass,
                  "appearance-none pr-9",
                  !form.cardAccountId && "text-muted-foreground"
                )}
              >
                <option value="">{cardsBusy ? "Loading cards…" : "Select card"}</option>
                {cards.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountSelectLabel(a)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="commitment-note" className="text-xs font-medium text-slate-600">
            Note
          </Label>
          <Input
            id="commitment-note"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={fieldClass}
            placeholder=""
            autoComplete="off"
          />
        </div>
      </div>
    </FormDialog>
  )
}

/** Wrapper has no hooks — mounted subtree owns form state and resets on unmount when `open` is false. */
export function AddCommitmentModal({ open, onOpenChange }: AddCommitmentModalProps) {
  if (!open) return null
  return <AddCommitmentModalMounted open={open} onOpenChange={onOpenChange} />
}
