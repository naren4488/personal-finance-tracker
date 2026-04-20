import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { PasswordInput } from "@/features/auth/password-input"
import { registerRequestSchema, type RegisterRequest } from "@/lib/api/auth-schemas"
import { getAuthErrorMessage } from "@/lib/api/errors"
import { useRegisterMutation } from "@/store/api/base-api"
import { isAuthApiDebugEnabled } from "@/lib/debug/auth-api-log"
import { safeReturnPath } from "@/features/auth/safe-return-path"
import { APP_FORM_FIELD_CLASS, APP_FORM_SUBMIT_CLASS } from "@/lib/ui/app-form-styles"

export function RegisterForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const [registerUser, { isLoading }] = useRegisterMutation()

  const form = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { name: "", email: "", password: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const body: RegisterRequest = {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    }
    if (isAuthApiDebugEnabled()) {
      console.groupCollapsed("[Koin auth] Register form — submit clicked")
      console.log("Step: Zod validation passed; calling register mutation")
      console.log("Payload:", body)
      console.log("Keys:", Object.keys(body).sort().join(", "))
      console.groupEnd()
    }
    try {
      const data = await registerUser(body).unwrap()
      if (isAuthApiDebugEnabled()) {
        console.log(
          "[Koin auth] Register form — mutation succeeded → auto-login → dashboard",
          data.user
        )
      }
      toast.success(data.user.name ? `Welcome, ${data.user.name}!` : "Account created")
      const next = safeReturnPath((location.state as { from?: string } | null)?.from) ?? "/"
      navigate(next, { replace: true })
    } catch (err) {
      const msg = getAuthErrorMessage(err)
      if (isAuthApiDebugEnabled()) {
        console.groupCollapsed("[Koin auth] Register form — mutation failed")
        console.error("Shown in UI:", msg)
        console.error("Raw error:", err)
        console.groupEnd()
      }
      toast.error(msg)
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className={APP_FORM_FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={APP_FORM_FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={APP_FORM_FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="bg-border/60" />

        <Button type="submit" className={APP_FORM_SUBMIT_CLASS} disabled={isLoading}>
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Form>
  )
}
