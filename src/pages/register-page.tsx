import { AuthLayout } from "@/features/auth/auth-layout"
import { RedirectIfAuthed } from "@/features/auth/redirect-if-authed"
import { RegisterForm } from "@/features/auth/register-form"

export default function RegisterPage() {
  return (
    <>
      <RedirectIfAuthed />
      <AuthLayout mode="register">
        <RegisterForm />
      </AuthLayout>
    </>
  )
}
