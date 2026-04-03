import { useCallback, useEffect, useId, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Gem,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getErrorMessage } from "@/lib/api/errors"
import { clearToken } from "@/lib/auth/token"
import { cn } from "@/lib/utils"
import { useCreatePersonMutation, useGetPeopleQuery } from "@/store/api/base-api"
import { clearUser } from "@/store/auth-slice"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const PAID_FROM_OPTIONS = ["HDFC Savings", "Cash wallet", "UPI — Primary"] as const

const ENTRY_TYPES = [
  { id: "lent" as const, label: "Money Given (Lent)", Icon: ArrowUp },
  { id: "borrowed" as const, label: "Money Taken (Borrowed)", Icon: ArrowDown },
  { id: "received" as const, label: "Payment Received", Icon: ArrowLeft },
  { id: "paid" as const, label: "Payment Made", Icon: ArrowRight },
]

type EntryTypeId = (typeof ENTRY_TYPES)[number]["id"]
type PaymentMethod = "account" | "card"
type PersonMode = "existing" | "new"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export type UdharFormState = {
  personMode: PersonMode
  selectedPersonId: string
  personName: string
  personPhone: string
  entryType: EntryTypeId
  amount: string
  paymentMethod: PaymentMethod
  paidFrom: string
  date: string
  askBackBy: string
  note: string
}

function initialFormState(): UdharFormState {
  return {
    personMode: "existing",
    selectedPersonId: "",
    personName: "",
    personPhone: "",
    entryType: "lent",
    amount: "",
    paymentMethod: "account",
    paidFrom: "",
    date: todayIsoDate(),
    askBackBy: "",
    note: "",
  }
}

function ToggleTile({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-13 items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-center text-xs font-medium leading-tight transition-colors sm:text-[13px]",
        selected
          ? "border-primary bg-sky-50 text-primary dark:bg-primary/15"
          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddUdharEntrySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isAuthTokenRequiredMessage(message: string): boolean {
  return message.toLowerCase().includes("authorization token is required")
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
}

/**
 * Renders only while the sheet is open. Unmounting clears form state without useEffect resets.
 */
function AddUdharEntrySheetMounted({ onOpenChange }: MountedProps) {
  const titleId = useId()
  const selectPersonId = useId()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const people = useAppSelector((s) => s.people.items)
  const { isLoading: peopleQueryLoading, isFetching: peopleQueryFetching } = useGetPeopleQuery()
  const [createPerson, { isLoading: isCreatingPerson }] = useCreatePersonMutation()
  const peopleListLoading = peopleQueryLoading || peopleQueryFetching

  const [form, setForm] = useState(() => initialFormState())

  const dismiss = useCallback(() => {
    document.body.style.overflow = ""
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dismiss])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let effectivePersonId = form.selectedPersonId
    let resolvedPersonName: string | undefined

    if (form.personMode === "new") {
      const name = form.personName.trim()
      if (!name) {
        toast.error("Enter the person's name")
        return
      }
      try {
        const response = await createPerson({
          name,
          phoneNumber: form.personPhone.trim() || undefined,
        }).unwrap()
        console.log("Success", response)
        toast.success("Person added")
        setForm((f) => ({
          ...f,
          personMode: "existing",
          personName: "",
          personPhone: "",
          selectedPersonId: response.id,
        }))
        effectivePersonId = response.id
        resolvedPersonName = response.name
      } catch (err) {
        console.error("Error", err)
        const msg = getErrorMessage(err)
        if (isAuthTokenRequiredMessage(msg)) {
          toast.error("Please sign in again")
          clearToken()
          dispatch(clearUser())
          dismiss()
          navigate("/login", { replace: true })
          return
        }
        toast.error(msg)
        return
      }
    } else {
      if (!form.selectedPersonId) {
        toast.error("Select a person")
        return
      }
      effectivePersonId = form.selectedPersonId
      resolvedPersonName = people.find((p) => p.id === form.selectedPersonId)?.name
    }

    const n = form.amount.replace(/\D/g, "")
    if (!n || Number(n) <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.paidFrom) {
      toast.error("Select an account")
      return
    }

    console.log("[Udhar] Add Entry (demo log — no udhar API yet)", {
      entryType: form.entryType,
      selectedPersonId: effectivePersonId,
      personName: resolvedPersonName,
      amountInr: Number(n),
      paymentMethod: form.paymentMethod,
      paidFrom: form.paidFrom,
      date: form.date,
      askBackBy: form.askBackBy || undefined,
      note: form.note.trim() || undefined,
    })

    toast.success("Entry saved (demo)")
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close overlay"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-4">
          <h2 id={titleId} className="text-lg font-bold text-primary">
            Add Udhar Entry
          </h2>
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
            <section>
              <Label className="mb-2 block text-sm font-bold text-primary">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {ENTRY_TYPES.map(({ id, label, Icon }) => (
                  <ToggleTile
                    key={id}
                    selected={form.entryType === id}
                    onClick={() => setForm((f) => ({ ...f, entryType: id }))}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    <span>{label}</span>
                  </ToggleTile>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="text-sm font-bold text-primary">Person</Label>
                {form.personMode === "existing" ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() =>
                      setForm((f) => ({ ...f, personMode: "new", selectedPersonId: "" }))
                    }
                  >
                    + Add New
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        personMode: "existing",
                        personName: "",
                        personPhone: "",
                      }))
                    }
                  >
                    Select Existing
                  </button>
                )}
              </div>

              {form.personMode === "existing" ? (
                <div className="space-y-1.5">
                  {peopleListLoading ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : null}
                  <div className="relative">
                    <select
                      id={selectPersonId}
                      value={form.selectedPersonId}
                      disabled={peopleListLoading && people.length === 0}
                      onChange={(e) => setForm((f) => ({ ...f, selectedPersonId: e.target.value }))}
                      className={cn(
                        "h-11 w-full appearance-none rounded-xl border border-border bg-muted/50 px-3.5 pr-10 text-base text-foreground outline-none",
                        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        !form.selectedPersonId && "text-muted-foreground"
                      )}
                    >
                      <option value="">Select person</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.phoneNumber?.trim() ? ` · ${p.phoneNumber}` : ""}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Person's name"
                    value={form.personName}
                    onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                    className="h-11 rounded-xl border-border bg-muted/50 px-3.5 text-base"
                    autoComplete="name"
                  />
                  <Input
                    type="tel"
                    placeholder="Phone number (optional)"
                    value={form.personPhone}
                    onChange={(e) => setForm((f) => ({ ...f, personPhone: e.target.value }))}
                    className="h-11 rounded-xl border-border bg-muted/50 px-3.5 text-base"
                    autoComplete="tel"
                  />
                </div>
              )}
            </section>

            <section>
              <Label htmlFor="udhar-amount" className="mb-2 block text-sm font-bold text-primary">
                Amount (₹)
              </Label>
              <Input
                id="udhar-amount"
                inputMode="numeric"
                placeholder="0"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d]/g, "") }))
                }
                className="h-16 rounded-xl border-border bg-muted/60 text-center text-3xl font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
              />
            </section>

            <section>
              <Label className="mb-2 block text-sm font-bold text-primary">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <ToggleTile
                  selected={form.paymentMethod === "account"}
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: "account" }))}
                >
                  <CreditCard className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>Account / Cash / UPI</span>
                </ToggleTile>
                <ToggleTile
                  selected={form.paymentMethod === "card"}
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: "card" }))}
                >
                  <Gem className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>Credit Card</span>
                </ToggleTile>
              </div>
            </section>

            <section>
              <Label
                htmlFor="udhar-paid-from"
                className="mb-2 block text-sm font-bold text-primary"
              >
                Paid From
              </Label>
              <div className="relative">
                <select
                  id="udhar-paid-from"
                  value={form.paidFrom}
                  onChange={(e) => setForm((f) => ({ ...f, paidFrom: e.target.value }))}
                  className={cn(
                    "h-11 w-full appearance-none rounded-xl border border-border bg-muted/50 px-3.5 pr-10 text-base text-foreground outline-none",
                    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                    !form.paidFrom && "text-muted-foreground"
                  )}
                >
                  <option value="">Select account</option>
                  {PAID_FROM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </section>

            <section>
              <Label htmlFor="udhar-date" className="mb-2 block text-sm font-bold text-primary">
                Date
              </Label>
              <div className="relative">
                <Input
                  id="udhar-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="h-11 rounded-xl border-border bg-muted/50 px-3.5 pr-11 text-base scheme-light dark:scheme-dark"
                />
                <CalendarDays
                  className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
            </section>

            <section>
              <Label htmlFor="udhar-ask-back" className="mb-2 block text-sm font-bold text-primary">
                Ask money back by
              </Label>
              <div className="relative">
                <Input
                  id="udhar-ask-back"
                  type="date"
                  value={form.askBackBy}
                  onChange={(e) => setForm((f) => ({ ...f, askBackBy: e.target.value }))}
                  className="h-11 rounded-xl border-border bg-muted/50 px-3.5 pr-11 text-base scheme-light dark:scheme-dark"
                />
                <CalendarDays
                  className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                When should this person return the money?
              </p>
            </section>

            <section>
              <Label htmlFor="udhar-note" className="mb-2 block text-sm font-bold text-primary">
                Note
              </Label>
              <textarea
                id="udhar-note"
                rows={3}
                placeholder="What was this for?"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className={cn(
                  "w-full resize-none rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-base text-foreground outline-none",
                  "placeholder:text-muted-foreground/80",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            </section>
          </div>

          <div className="shrink-0 border-t border-border bg-card px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              disabled={isCreatingPerson}
              className="h-12 w-full rounded-xl bg-[hsl(230_22%_62%)] text-base font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60"
            >
              {isCreatingPerson ? "Saving…" : "Add Entry"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Wrapper has no hooks — mounted subtree owns form state and resets on unmount when `open` is false. */
export function AddUdharEntrySheet({ open, onOpenChange }: AddUdharEntrySheetProps) {
  if (!open) return null
  return <AddUdharEntrySheetMounted onOpenChange={onOpenChange} />
}
