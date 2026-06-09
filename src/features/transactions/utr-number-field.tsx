import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import { utrFieldVisibleForAccount } from "@/lib/transactions/utr-account"
import { APP_FORM_FIELD_CLASS, APP_FORM_LABEL_CLASS } from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"

export type UtrNumberFieldProps = {
  selectedAccount: Account | undefined
  value: string
  onChange: (value: string) => void
  id?: string
  labelClassName?: string
  fieldClassName?: string
}

/** Optional UTR input — visible for bank, UPI, and digital wallet source accounts. */
export function UtrNumberField({
  selectedAccount,
  value,
  onChange,
  id: idProp,
  labelClassName = APP_FORM_LABEL_CLASS,
  fieldClassName = APP_FORM_FIELD_CLASS,
}: UtrNumberFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId

  if (!utrFieldVisibleForAccount(selectedAccount)) return null

  return (
    <section>
      <Label htmlFor={id} className={labelClassName}>
        UTR Number <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="Enter UTR"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(fieldClassName)}
      />
    </section>
  )
}
