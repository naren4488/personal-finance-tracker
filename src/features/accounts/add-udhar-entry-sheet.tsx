import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateUdharEntryRequest } from "@/lib/api/udhar-schemas"
import { endUserSession } from "@/lib/auth/end-session"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import { cn } from "@/lib/utils"
import {
  useCreatePersonMutation,
  useCreateUdharEntryMutation,
  useGetAccountsQuery,
  useGetPeopleQuery,
} from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const ENTRY_TYPES = [
  { id: "money_given" as const, label: "Money Given (Lent)", Icon: ArrowUp },
  { id: "money_taken" as const, label: "Money Taken (Borrowed)", Icon: ArrowDown },
  { id: "payment_received" as const, label: "Payment Received", Icon: ArrowLeft },
  { id: "payment_made" as const, label: "Payment Made", Icon: ArrowRight },
]

type EntryTypeId = (typeof ENTRY_TYPES)[number]["id"]
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
  accountId: string
  date: string
  dueDate: string
  note: string
}

function initialFormState(): UdharFormState {
  return {
    personMode: "existing",
    selectedPersonId: "",
    personName: "",
    personPhone: "",
    entryType: "money_given",
    amount: "",
    accountId: "",
    date: todayIsoDate(),
    dueDate: "",
    note: "",
  }
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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
  const user = useAppSelector((s) => s.auth.user)
  const people = useAppSelector((s) => s.people.items)
  const { isLoading: peopleQueryLoading, isFetching: peopleQueryFetching } = useGetPeopleQuery()
  const [createPerson, { isLoading: isCreatingPerson }] = useCreatePersonMutation()
  const [createUdharEntry, { isLoading: isUdharSubmitting }] = useCreateUdharEntryMutation()
  const {
    data: accountsRaw = [],
    isLoading: accountsLoading,
    isFetching: accountsFetching,
  } = useGetAccountsQuery(undefined, { skip: !user })
  const accounts = useMemo(() => filterActiveAccounts(accountsRaw), [accountsRaw])
  const peopleListLoading = peopleQueryLoading || peopleQueryFetching
  const accountsListLoading = accountsLoading || accountsFetching

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
        toast.success("Person added")
        setForm((f) => ({
          ...f,
          personMode: "existing",
          personName: "",
          personPhone: "",
          selectedPersonId: response.id,
        }))
        effectivePersonId = response.id
      } catch (err) {
        const msg = getErrorMessage(err)
        if (isAuthTokenRequiredMessage(msg)) {
          toast.error("Please sign in again")
          endUserSession(dispatch)
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
    }

    const n = form.amount.replace(/\D/g, "")
    if (!n || Number(n) <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.accountId) {
      toast.error("Select an account")
      return
    }
    if (!form.dueDate) {
      toast.error("Select due date")
      return
    }

    const payload: CreateUdharEntryRequest = {
      entryType: form.entryType,
      personId: effectivePersonId,
      amount: String(Number(n)),
      accountId: form.accountId,
      date: form.date,
      dueDate: form.dueDate,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    try {
      await createUdharEntry(payload).unwrap()
      toast.success("udhar entry created successfully")
      setForm(initialFormState())
      dismiss()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (isAuthTokenRequiredMessage(msg)) {
        toast.error("Please sign in again")
        endUserSession(dispatch)
        dismiss()
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg)
    }
  }

  const fieldClass =
    "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
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
          "relative flex min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
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
          <div className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-2 px-4 py-2")}>
            <section>
              <Label className="mb-0.5 block text-xs font-bold text-primary">Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
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
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <Label className="text-xs font-bold text-primary">Person</Label>
                {form.personMode === "existing" ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() =>
                      setForm((f) => ({ ...f, personMode: "new", selectedPersonId: "" }))
                    }
                  >
                    + Add New
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
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
                        fieldClass,
                        "w-full appearance-none pr-9",
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
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
                    placeholder="Person's name"
                    value={form.personName}
                    onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                    className="rounded-xl border-border bg-muted/50 px-3 text-sm h-9"
                    autoComplete="name"
                  />
                  <Input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={form.personPhone}
                    onChange={(e) => setForm((f) => ({ ...f, personPhone: e.target.value }))}
                    className="rounded-xl border-border bg-muted/50 px-3 text-sm h-9"
                    autoComplete="tel"
                  />
                </div>
              )}
            </section>

            <section>
              <Label htmlFor="udhar-amount" className="mb-0.5 block text-xs font-bold text-primary">
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
                className="h-12 rounded-xl border-border bg-muted/60 text-center text-2xl font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
              />
            </section>

            <section>
              <Label
                htmlFor="udhar-account"
                className="mb-0.5 block text-xs font-bold text-primary"
              >
                Account
              </Label>
              <div className="relative">
                {accountsListLoading ? (
                  <p className="text-xs text-muted-foreground">Loading accounts…</p>
                ) : accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add an account first to link this entry.
                  </p>
                ) : null}
                <select
                  id="udhar-account"
                  value={form.accountId}
                  disabled={accountsListLoading || accounts.length === 0}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                  className={cn(
                    fieldClass,
                    "w-full appearance-none pr-9",
                    !form.accountId && "text-muted-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountSelectLabel(a)}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="udhar-date" className="mb-0.5 block text-xs font-bold text-primary">
                  Date
                </Label>
                <div className="relative">
                  <Input
                    id="udhar-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className={cn(fieldClass, "pr-9 scheme-light dark:scheme-dark")}
                  />
                  <CalendarDays
                    className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </section>
              <section>
                <Label
                  htmlFor="udhar-due-date"
                  className="mb-0.5 block text-xs font-bold text-primary"
                >
                  Due date
                </Label>
                <div className="relative">
                  <Input
                    id="udhar-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className={cn(fieldClass, "pr-9 scheme-light dark:scheme-dark")}
                  />
                  <CalendarDays
                    className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </section>
            </div>

            <section>
              <Label htmlFor="udhar-note" className="mb-0.5 block text-xs font-bold text-primary">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="udhar-note"
                rows={2}
                placeholder="What was this for?"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className={cn(
                  "min-h-9 w-full resize-none rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm outline-none",
                  "placeholder:text-muted-foreground/80",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            </section>
          </div>

          <div className={cn(FORM_OVERLAY_FOOTER, "px-4")}>
            <Button
              type="submit"
              disabled={isCreatingPerson || isUdharSubmitting}
              className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
            >
              {isCreatingPerson ? "Saving…" : isUdharSubmitting ? "Submitting…" : "Add Entry"}
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
