import { AuthLayout } from "@/features/auth/auth-layout"
import { LoginForm } from "@/features/auth/login-form"
import { RedirectIfAuthed } from "@/features/auth/redirect-if-authed"

export default function LoginPage() {
  return (
    <>
      <RedirectIfAuthed />
      <AuthLayout mode="login">
        <LoginForm />
      </AuthLayout>
    </>
  )
}
