import { useCallback, useEffect, useId, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { cn } from "@/lib/utils"

const CARD_NETWORKS = ["Visa", "Mastercard", "RuPay", "American Express", "Other"] as const

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = cardName.trim()
    if (!name) {
      toast.error("Enter card name")
      return
    }
    if (!cardNetwork) {
      toast.error("Select card network")
      return
    }
    const l4 = last4.replace(/\D/g, "")
    if (l4.length !== 4) {
      toast.error("Enter last 4 digits")
      return
    }

    console.log("[Cards] Add Credit Card (demo)", {
      cardName: name,
      bankName: bankName.trim() || undefined,
      cardNetwork,
      last4: l4,
      creditLimitInr: Number(creditLimit.replace(/\D/g, "")) || 0,
      outstandingInr: Number(outstanding.replace(/\D/g, "")) || 0,
      billGenerationDay: Number(billDay),
      paymentDueDay: Number(dueDay),
      interestRatePercent: Number(interestRate.replace(/,/g, "")) || 0,
      minDuePercent: Number(minDuePercent.replace(/,/g, "")) || 0,
    })

    toast.success("Card saved (demo)")
    dismiss()
  }

  const fieldBase =
    "h-9 rounded-xl border border-border bg-muted/50 px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

  return (
    <div className="fixed inset-0 z-50 flex max-h-dvh items-start justify-center overflow-hidden pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:py-4">
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
          "relative flex max-h-[calc(100dvh-0.75rem-env(safe-area-inset-bottom))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Add Credit Card
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
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-4 py-2">
            <section>
              <Label htmlFor="cc-name" className="mb-0.5 block text-xs font-bold text-primary">
                Card Name
              </Label>
              <Input
                id="cc-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. HDFC Regalia"
                className={cn(fieldBase)}
              />
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="cc-bank" className="mb-0.5 block text-xs font-bold text-primary">
                  Bank Name
                </Label>
                <Input
                  id="cc-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor={networkId} className="mb-0.5 block text-xs font-bold text-primary">
                  Card Network
                </Label>
                <div className="relative">
                  <select
                    id={networkId}
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value)}
                    className={cn(
                      fieldBase,
                      "w-full appearance-none pr-9",
                      !cardNetwork && "text-muted-foreground"
                    )}
                  >
                    <option value="">Select</option>
                    {CARD_NETWORKS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="cc-last4" className="mb-0.5 block text-xs font-bold text-primary">
                  Last 4 Digits
                </Label>
                <Input
                  id="cc-last4"
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor="cc-limit" className="mb-0.5 block text-xs font-bold text-primary">
                  Credit Limit (₹)
                </Label>
                <Input
                  id="cc-limit"
                  inputMode="numeric"
                  placeholder="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d]/g, ""))}
                  className={cn(fieldBase)}
                />
              </section>
            </div>

            <section>
              <Label htmlFor="cc-out" className="mb-0.5 block text-xs font-bold text-primary">
                Current Outstanding (₹)
              </Label>
              <Input
                id="cc-out"
                inputMode="numeric"
                placeholder="0 (if card already has usage)"
                value={outstanding}
                onChange={(e) => setOutstanding(e.target.value.replace(/[^\d]/g, ""))}
                className={cn(fieldBase)}
              />
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                Enter existing unpaid amount if any. Leave 0 for new cards.
              </p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="cc-bill" className="mb-0.5 block text-xs font-bold text-primary">
                  Bill Generation Date
                </Label>
                <div className="relative">
                  <select
                    id="cc-bill"
                    value={billDay}
                    onChange={(e) => setBillDay(e.target.value)}
                    className={cn(fieldBase, "w-full appearance-none pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                  Day your bill is generated
                </p>
              </section>
              <section>
                <Label htmlFor="cc-due" className="mb-0.5 block text-xs font-bold text-primary">
                  Payment Due Date
                </Label>
                <div className="relative">
                  <select
                    id="cc-due"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className={cn(fieldBase, "w-full appearance-none pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                  Day your payment is due
                </p>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="cc-rate" className="mb-0.5 block text-xs font-bold text-primary">
                  Interest Rate (%)
                </Label>
                <Input
                  id="cc-rate"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="3.5"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor="cc-min" className="mb-0.5 block text-xs font-bold text-primary">
                  Min Due (%)
                </Label>
                <Input
                  id="cc-min"
                  inputMode="decimal"
                  value={minDuePercent}
                  onChange={(e) => setMinDuePercent(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="5"
                  className={cn(fieldBase)}
                />
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-card px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] sm:h-11 sm:text-base"
            >
              Add Card
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
