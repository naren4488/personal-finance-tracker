import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  quickTransactionFormSchema,
  toQuickTransactionPayload,
  type QuickTransactionFormValues,
} from "@/lib/api/schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { cn } from "@/lib/utils"
import { useAddTransactionMutation } from "@/store/api/base-api"

type QuickTransactionFormProps = {
  onSuccess?: () => void
  className?: string
}

export function QuickTransactionForm({ onSuccess, className }: QuickTransactionFormProps) {
  const [addTransaction, { isLoading }] = useAddTransactionMutation()

  const form = useForm<QuickTransactionFormValues>({
    resolver: zodResolver(quickTransactionFormSchema),
    defaultValues: {
      title: "",
      amount: "",
      type: "expense",
    },
  })

  const transactionType = useWatch({ control: form.control, name: "type" })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = toQuickTransactionPayload(values)
      await addTransaction(payload).unwrap()
      console.log("[transactions] quick add success", payload)
      toast.success("Transaction added")
      form.reset({ title: "", amount: "", type: values.type })
      onSuccess?.()
    } catch (err) {
      console.error("[transactions] quick add error", err)
      toast.error(getErrorMessage(err))
    }
  })

  return (
    <Card className={cn("rounded-2xl border-border/80 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base">Quick add</CardTitle>
        <CardDescription>Validated with Zod and sent to POST /transactions.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.title}>
              <FieldLabel htmlFor="qt-title">Description</FieldLabel>
              <FieldContent>
                <Input
                  id="qt-title"
                  className="h-12 rounded-xl"
                  placeholder="e.g. Coffee"
                  autoComplete="off"
                  {...form.register("title")}
                  aria-invalid={!!form.formState.errors.title}
                />
                <FieldError errors={[form.formState.errors.title]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!form.formState.errors.amount}>
              <FieldLabel htmlFor="qt-amount">Amount (₹)</FieldLabel>
              <FieldContent>
                <Input
                  id="qt-amount"
                  className="h-12 rounded-xl"
                  inputMode="decimal"
                  placeholder="0"
                  autoComplete="off"
                  {...form.register("amount")}
                  aria-invalid={!!form.formState.errors.amount}
                />
                <FieldError errors={[form.formState.errors.amount]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <FieldContent className="flex flex-row gap-2">
                <Button
                  type="button"
                  variant={transactionType === "expense" ? "default" : "secondary"}
                  className="rounded-xl"
                  onClick={() => form.setValue("type", "expense", { shouldValidate: true })}
                >
                  Expense
                </Button>
                <Button
                  type="button"
                  variant={transactionType === "income" ? "default" : "secondary"}
                  className="rounded-xl"
                  onClick={() => form.setValue("type", "income", { shouldValidate: true })}
                >
                  Income
                </Button>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full rounded-xl text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading ? "Saving…" : "Add transaction"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
