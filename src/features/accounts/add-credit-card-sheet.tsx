import { useCallback, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { type CreateAccountRequest } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
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
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddCreditCardSheetMounted({ open, onOpenChange }: MountedProps) {
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
    onOpenChange(false)
  }, [onOpenChange])

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

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Credit Card"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-center justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
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
      }
      formProps={{ onSubmit: (e) => void handleSubmit(e) }}
      footer={
        <Button type="submit" disabled={isSubmitting} className={APP_FORM_SUBMIT_CLASS}>
          {isSubmitting ? "Saving..." : "Add Credit Card"}
        </Button>
      }
    >
      <div className={APP_FORM_STACK_CLASS}>
        <section>
          <Label htmlFor="cc-name" className={APP_FORM_LABEL_CLASS}>
            Card Name
          </Label>
          <Input
            id="cc-name"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="e.g. HDFC Regalia"
            className={APP_FORM_FIELD_CLASS}
          />
        </section>

        <div className={APP_FORM_TWO_COL_GRID_CLASS}>
          <section>
            <Label htmlFor="cc-bank" className={APP_FORM_LABEL_CLASS}>
              Bank Name
            </Label>
            <Input
              id="cc-bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. HDFC"
              className={APP_FORM_FIELD_CLASS}
            />
          </section>
          <section>
            <Label htmlFor={networkId} className={APP_FORM_LABEL_CLASS}>
              Card Network
            </Label>
            <div className="relative">
              <select
                id={networkId}
                value={cardNetwork}
                onChange={(e) => setCardNetwork(e.target.value)}
                className={cn(APP_FORM_SELECT_CLASS, "border-primary")}
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

        <div className={APP_FORM_TWO_COL_GRID_CLASS}>
          <section>
            <Label htmlFor="cc-last4" className={APP_FORM_LABEL_CLASS}>
              Last 4 Digits
            </Label>
            <Input
              id="cc-last4"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
              placeholder="1234"
              className={APP_FORM_FIELD_CLASS}
            />
          </section>
          <section>
            <Label htmlFor="cc-limit" className={APP_FORM_LABEL_CLASS}>
              Credit Limit (₹)
            </Label>
            <Input
              id="cc-limit"
              inputMode="numeric"
              placeholder="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d]/g, ""))}
              className={APP_FORM_FIELD_CLASS}
            />
          </section>
        </div>

        <section>
          <Label htmlFor="cc-out" className={APP_FORM_LABEL_CLASS}>
            Current Outstanding (₹)
          </Label>
          <Input
            id="cc-out"
            inputMode="numeric"
            placeholder="0"
            value={outstanding}
            onChange={(e) => setOutstanding(e.target.value.replace(/[^\d]/g, ""))}
            className={APP_FORM_FIELD_CLASS}
          />
        </section>

        <div className={APP_FORM_TWO_COL_GRID_CLASS}>
          <section>
            <Label htmlFor="cc-bill" className={APP_FORM_LABEL_CLASS}>
              Bill Generation Day
            </Label>
            <div className="relative">
              <select
                id="cc-bill"
                value={billDay}
                onChange={(e) => setBillDay(e.target.value)}
                className={APP_FORM_SELECT_CLASS}
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
            <Label htmlFor="cc-due" className={APP_FORM_LABEL_CLASS}>
              Payment Due Day
            </Label>
            <div className="relative">
              <select
                id="cc-due"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className={APP_FORM_SELECT_CLASS}
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

        <div className={APP_FORM_TWO_COL_GRID_CLASS}>
          <section>
            <Label htmlFor="cc-rate" className={APP_FORM_LABEL_CLASS}>
              Interest Rate (%)
            </Label>
            <Input
              id="cc-rate"
              inputMode="decimal"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="3.5"
              className={APP_FORM_FIELD_CLASS}
            />
          </section>
          <section>
            <Label htmlFor="cc-min" className={APP_FORM_LABEL_CLASS}>
              Min Due (%)
            </Label>
            <Input
              id="cc-min"
              inputMode="decimal"
              value={minDuePercent}
              onChange={(e) => setMinDuePercent(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="5"
              className={APP_FORM_FIELD_CLASS}
            />
          </section>
        </div>
      </div>
    </FormDialog>
  )
}

export function AddCreditCardSheet({ open, onOpenChange }: AddCreditCardSheetProps) {
  if (!open) return null
  return <AddCreditCardSheetMounted open={open} onOpenChange={onOpenChange} />
}
