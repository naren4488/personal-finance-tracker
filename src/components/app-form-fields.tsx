import type { ReactNode } from "react"
import type { Control, FieldPath, FieldValues } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { APP_FORM_FIELD_CLASS, APP_FORM_LABEL_CLASS } from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"

type BaseProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: ReactNode
  className?: string
  labelClassName?: string
}

export function AppFormInputField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  labelClassName,
  inputClassName,
  ...inputProps
}: BaseProps<T> &
  Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "defaultValue"> & {
    inputClassName?: string
  }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("min-w-0", className)}>
          <FormLabel className={cn(APP_FORM_LABEL_CLASS, labelClassName)}>{label}</FormLabel>
          <FormControl>
            <Input
              className={cn(APP_FORM_FIELD_CLASS, inputClassName)}
              {...field}
              {...inputProps}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function AppFormTextareaField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  labelClassName,
  textareaClassName,
  rows = 2,
  ...textareaProps
}: BaseProps<T> &
  Omit<React.ComponentProps<"textarea">, "name" | "value" | "onChange" | "defaultValue"> & {
    textareaClassName?: string
  }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className={cn(APP_FORM_LABEL_CLASS, labelClassName)}>{label}</FormLabel>
          <FormControl>
            <textarea
              rows={rows}
              className={cn(APP_FORM_FIELD_CLASS, "min-h-20 resize-none", textareaClassName)}
              {...field}
              {...textareaProps}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SelectOption = { value: string; label: string }

export function AppFormSelectField<T extends FieldValues>({
  control,
  name,
  label,
  className,
  labelClassName,
  selectClassName,
  options,
  placeholder,
  disabled,
  children,
  selectChevron,
}: BaseProps<T> & {
  selectClassName?: string
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  children?: ReactNode
  /** Rendered inside a relative wrapper; must not wrap FormControl (shadcn Slot). */
  selectChevron?: ReactNode
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("min-w-0", className)}>
          <FormLabel className={cn(APP_FORM_LABEL_CLASS, labelClassName)}>{label}</FormLabel>
          <div className={selectChevron ? "relative" : undefined}>
            <FormControl>
              <select
                className={selectClassName}
                disabled={disabled}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                name={field.name}
              >
                {placeholder ? (
                  <option value="" disabled={!field.value}>
                    {placeholder}
                  </option>
                ) : null}
                {children ??
                  options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </FormControl>
            {selectChevron}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
