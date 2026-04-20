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
import { loginRequestSchema, type LoginRequest } from "@/lib/api/auth-schemas"
import { getAuthErrorMessage } from "@/lib/api/errors"
import { useLoginMutation } from "@/store/api/base-api"
import { isAuthApiDebugEnabled } from "@/lib/debug/auth-api-log"
import { safeReturnPath } from "@/features/auth/safe-return-path"
import { APP_FORM_FIELD_CLASS, APP_FORM_SUBMIT_CLASS } from "@/lib/ui/app-form-styles"

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const [login, { isLoading }] = useLoginMutation()

  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const body: LoginRequest = {
      email: values.email.trim(),
      password: values.password,
    }
    if (isAuthApiDebugEnabled()) {
      console.groupCollapsed("[Koin auth] Login form — submit clicked")
      console.log("Step: Zod validation passed; calling login mutation")
      console.log("Payload (password hidden):", { email: body.email, password: "(hidden)" })
      console.log("Keys:", Object.keys(body).sort().join(", "))
      console.groupEnd()
    }
    try {
      await login(body).unwrap()
      if (isAuthApiDebugEnabled()) {
        console.log("[Koin auth] Login form — mutation succeeded → redirect to dashboard")
      }
      toast.success("Welcome back")
      const next = safeReturnPath((location.state as { from?: string } | null)?.from) ?? "/"
      navigate(next, { replace: true })
    } catch (err) {
      const msg = getAuthErrorMessage(err)
      if (isAuthApiDebugEnabled()) {
        console.groupCollapsed("[Koin auth] Login form — mutation failed")
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
                    autoComplete="current-password"
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
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}
