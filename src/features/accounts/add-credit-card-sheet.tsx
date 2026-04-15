import { useCallback, useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { type CreateAccountRequest } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import { cn } from "@/lib/utils"
import { useCreateAccountMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

const CARD_NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "rupay", label: "RuPay" },
  { value: "american_express", label: "American Express" },
  { value: "other", label: "Other" },
] as const

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddCreditCardSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
}

function AddCreditCardSheetMounted({ onOpenChange }: MountedProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const titleId = useId()
  const networkId = useId()

  const [cardName, setCardName] = useState("")
  const [bankName, setBankName] = useState("")
  const [cardNetwork, setCardNetwork] = useState("")
  const [last4, setLast4] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [outstanding, setOutstanding] = useState("")
  const [billDay, setBillDay] = useState("1")
  const [dueDay, setDueDay] = useState("5")
  const [interestRate, setInterestRate] = useState("3.5")
  const [minDuePercent, setMinDuePercent] = useState("5")
  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()

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

  function resetForm() {
    setCardName("")
    setBankName("")
    setCardNetwork("")
    setLast4("")
    setCreditLimit("")
    setOutstanding("")
    setBillDay("1")
    setDueDay("5")
    setInterestRate("3.5")
    setMinDuePercent("5")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = cardName.trim()
    if (!name) return toast.error("Enter card name")

    const bank = bankName.trim()
    if (!bank) return toast.error("Enter bank name")

    if (!cardNetwork) return toast.error("Select card network")

    const l4 = last4.replace(/\D/g, "")
    if (l4.length !== 4) return toast.error("Enter last 4 digits")

    const limitDigits = creditLimit.replace(/\D/g, "")
    if (!limitDigits || Number(limitDigits) <= 0) return toast.error("Enter valid credit limit")

    const payload: CreateAccountRequest = {
      name,
      kind: "credit_card",
      balanceInr: Number(outstanding.replace(/\D/g, "")) || 0,
      bankName: bank,
      isActive: true,
      cardNetwork,
      last4Digits: l4,
      creditLimitInr: Number(limitDigits),
      billGenerationDay: Number(billDay),
      paymentDueDay: Number(dueDay),
    }

    try {
      await createAccount(payload).unwrap()
      toast.success("Account created successfully")
      resetForm()
      dismiss()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/authorization token is required/i.test(msg)) {
        toast.error("Session expired, please login again")
        endUserSession(dispatch)
        dismiss()
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg)
    }
  }

  // Matching reference Loan component styles
  const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/80"

  const fieldBase =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"

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
          "relative flex mb-8 min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Add Credit Card
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="size-4" strokeWidth={2.5} />
          </Button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-4 px-5 py-5")}>
            <section>
              <Label htmlFor="cc-name" className={labelClass}>
                Card Name
              </Label>
              <Input
                id="cc-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. HDFC Regalia"
                className={fieldBase}
              />
            </section>

            <div className="grid grid-cols-2 gap-4">
              <section>
                <Label htmlFor="cc-bank" className={labelClass}>
                  Bank Name
                </Label>
                <Input
                  id="cc-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC"
                  className={fieldBase}
                />
              </section>
              <section>
                <Label htmlFor={networkId} className={labelClass}>
                  Card Network
                </Label>
                <div className="relative">
                  <select
                    id={networkId}
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value)}
                    className={cn(fieldBase, "appearance-none pr-9 border-primary")}
                  >
                    <option value="">Select</option>
                    {CARD_NETWORKS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <section>
                <Label htmlFor="cc-last4" className={labelClass}>
                  Last 4 Digits
                </Label>
                <Input
                  id="cc-last4"
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
                  placeholder="1234"
                  className={fieldBase}
                />
              </section>
              <section>
                <Label htmlFor="cc-limit" className={labelClass}>
                  Credit Limit (₹)
                </Label>
                <Input
                  id="cc-limit"
                  inputMode="numeric"
                  placeholder="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d]/g, ""))}
                  className={fieldBase}
                />
              </section>
            </div>

            <section>
              <Label htmlFor="cc-out" className={labelClass}>
                Current Outstanding (₹)
              </Label>
              <Input
                id="cc-out"
                inputMode="numeric"
                placeholder="0"
                value={outstanding}
                onChange={(e) => setOutstanding(e.target.value.replace(/[^\d]/g, ""))}
                className={fieldBase}
              />
            </section>

            <div className="grid grid-cols-2 gap-4">
              <section>
                <Label htmlFor="cc-bill" className={labelClass}>
                  Bill Generation Day
                </Label>
                <div className="relative">
                  <select
                    id="cc-bill"
                    value={billDay}
                    onChange={(e) => setBillDay(e.target.value)}
                    className={cn(fieldBase, "appearance-none pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
              <section>
                <Label htmlFor="cc-due" className={labelClass}>
                  Payment Due Day
                </Label>
                <div className="relative">
                  <select
                    id="cc-due"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className={cn(fieldBase, "appearance-none pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <section>
                <Label htmlFor="cc-rate" className={labelClass}>
                  Interest Rate (%)
                </Label>
                <Input
                  id="cc-rate"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="3.5"
                  className={fieldBase}
                />
              </section>
              <section>
                <Label htmlFor="cc-min" className={labelClass}>
                  Min Due (%)
                </Label>
                <Input
                  id="cc-min"
                  inputMode="decimal"
                  value={minDuePercent}
                  onChange={(e) => setMinDuePercent(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="5"
                  className={fieldBase}
                />
              </section>
            </div>
          </div>

          <div className={cn(FORM_OVERLAY_FOOTER, "px-5")}>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
            >
              {isSubmitting ? "Saving..." : "Add Credit Card"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddCreditCardSheet({ open, onOpenChange }: AddCreditCardSheetProps) {
  if (!open) return null
  return <AddCreditCardSheetMounted onOpenChange={onOpenChange} />
}
