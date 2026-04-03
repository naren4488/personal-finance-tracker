import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { clearToken } from "@/lib/auth/token"
import type { AuthUser } from "@/lib/api/auth-schemas"
import {
  loadProfileDraft,
  saveProfileDraft,
  type IncomeType,
  type ProfileDraft,
} from "@/lib/profile/local-profile-draft"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearUser, patchUser } from "@/store/auth-slice"
import { cn } from "@/lib/utils"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const incomeOptions: { value: IncomeType; label: string }[] = [
  { value: "salaried", label: "Salaried" },
  { value: "business", label: "Business" },
  { value: "freelance", label: "Freelance" },
]

function ProfileContent({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [name, setName] = useState(user.name ?? "")
  const [draft, setDraft] = useState<ProfileDraft>(() => loadProfileDraft(user.id))

  const email = user.email ?? ""
  const displayInitials = name.trim()
    ? initialsFromName(name)
    : email
      ? email.slice(0, 2).toUpperCase()
      : "?"

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function handleSaveProfile() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Name is required")
      return
    }
    dispatch(patchUser({ name: trimmed }))
    saveProfileDraft(user.id, draft)
    toast.success("Profile saved locally. Income & phone will sync when your API is ready.")
  }

  function handleSignOut() {
    clearToken()
    dispatch(clearUser())
    navigate("/login", { replace: true })
  }

  function handleDeleteAccount() {
    const ok = window.confirm(
      "Delete your account? This cannot be undone once your backend supports it. (Demo: not implemented.)"
    )
    if (ok) {
      toast.message("Account deletion needs a backend endpoint — not implemented yet.")
    }
  }

  function handlePhotoClick() {
    toast.message("Photo upload will be available when your profile API is ready.")
  }

  return (
    <main className="space-y-4 px-4 py-4 pb-28">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back
      </Link>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex gap-4">
            <div className="relative shrink-0">
              <Avatar className="size-20 border-2 border-primary/20">
                <AvatarFallback className="bg-muted text-lg font-bold text-primary">
                  {displayInitials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handlePhotoClick}
                className="absolute -right-0.5 -bottom-0.5 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md"
                aria-label="Change profile photo"
              >
                <Camera className="size-3.5" strokeWidth={2} />
              </button>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="truncate text-lg font-bold text-foreground">
                {name.trim() || "Your name"}
              </h2>
              <p className="truncate text-sm text-muted-foreground">{email || "—"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl bg-muted/40"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                value={draft.phone}
                onChange={(e) => updateDraft("phone", e.target.value)}
                placeholder="+91…"
                className="h-11 rounded-xl bg-muted/40"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={email}
              readOnly
              disabled
              className="h-11 rounded-xl bg-muted/30"
            />
            <p className="text-xs text-muted-foreground">
              Email comes from your account. Change it when your API supports it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Income settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex rounded-full bg-muted/80 p-1 ring-1 ring-border/40">
            {incomeOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateDraft("incomeType", value)}
                className={cn(
                  "flex-1 rounded-full py-2 text-center text-sm font-medium transition-all",
                  draft.incomeType === value
                    ? "bg-card font-semibold text-foreground shadow-sm ring-1 ring-primary/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-company">Company</Label>
              <Input
                id="profile-company"
                value={draft.company}
                onChange={(e) => updateDraft("company", e.target.value)}
                placeholder="Company name"
                className="h-11 rounded-xl bg-muted/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-salary-day">Salary day (1–31)</Label>
              <Input
                id="profile-salary-day"
                type="number"
                min={1}
                max={31}
                value={draft.salaryDay}
                onChange={(e) => updateDraft("salaryDay", e.target.value)}
                className="h-11 rounded-xl bg-muted/40"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-salary">Monthly salary (₹)</Label>
            <Input
              id="profile-salary"
              type="number"
              min={0}
              value={draft.monthlySalary}
              onChange={(e) => updateDraft("monthlySalary", e.target.value)}
              className="h-11 rounded-xl bg-muted/40"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="h-11 w-full rounded-xl text-base font-semibold"
          onClick={handleSaveProfile}
        >
          Save profile
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full rounded-xl text-base font-semibold"
          onClick={handleSignOut}
        >
          Sign out
        </Button>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-destructive hover:underline"
        >
          <Trash2 className="size-4" strokeWidth={2} />
          Delete account permanently
        </button>
      </div>
    </main>
  )
}

export default function ProfilePage() {
  const user = useAppSelector((s) => s.auth.user)

  if (!user) {
    return (
      <main className="px-4 py-4 pb-24">
        <p className="text-sm text-muted-foreground">
          You need to be signed in to view your profile.
        </p>
        <Button asChild className="mt-4 rounded-xl" variant="outline">
          <Link to="/login">Go to login</Link>
        </Button>
      </main>
    )
  }

  return <ProfileContent key={user.id} user={user} />
}
