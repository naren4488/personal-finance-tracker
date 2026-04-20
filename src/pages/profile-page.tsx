import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { AuthUser } from "@/lib/api/auth-schemas"
import { getErrorMessage, isFetchBaseQueryError } from "@/lib/api/errors"
import {
  buildUpdateProfileBody,
  mergeAuthUserWithProfile,
  parseProfileFieldErrorsFromApiData,
  profileUserToFormDefaults,
  type ProfileUser,
  type UpdateProfileRequest,
} from "@/lib/api/profile-schemas"
import { endUserSession } from "@/lib/auth/end-session"
import {
  loadProfileDraft,
  saveProfileDraft,
  type IncomeType,
  type ProfileDraft,
} from "@/lib/profile/local-profile-draft"
import {
  useDeleteMeMutation,
  useGetMeQuery,
  useLogoutMutation,
  useUpdateMeMutation,
} from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setUser } from "@/store/auth-slice"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SECONDARY_BTN_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
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

function coerceIncomeType(raw: string): IncomeType {
  if (raw === "business" || raw === "freelance") return raw
  return "salaried"
}

function profileUserToDraft(profile: ProfileUser): ProfileDraft {
  const d = profileUserToFormDefaults(profile)
  return {
    phone: d.phone,
    incomeType: coerceIncomeType(d.incomeType),
    company: d.company,
    salaryDay: d.salaryDay,
    monthlySalary: d.monthlySalary,
  }
}

function resolveProfileFormSource(
  isProfileLoading: boolean,
  isProfileSuccess: boolean,
  isProfileError: boolean,
  profileFromApi: ProfileUser | undefined
): "api" | "local" | null {
  if (isProfileLoading) return null
  if (isProfileSuccess && profileFromApi) return "api"
  if (isProfileSuccess && !profileFromApi) return "local"
  if (isProfileError) return "local"
  return null
}

type ProfileFormProps = {
  user: AuthUser
  initialName: string
  initialDraft: ProfileDraft
  updateMe: (body: UpdateProfileRequest) => { unwrap: () => Promise<ProfileUser> }
  deleteMe: () => { unwrap: () => Promise<{ message?: string }> }
  logout: () => { unwrap: () => Promise<unknown> }
  isSaving: boolean
  isDeletingAccount: boolean
  isLogoutLoading: boolean
}

function ProfileForm({
  user,
  initialName,
  initialDraft,
  updateMe,
  deleteMe,
  logout,
  isSaving,
  isDeletingAccount,
  isLogoutLoading,
}: ProfileFormProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [name, setName] = useState(initialName)
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const email = user.email ?? ""
  const displayInitials = name.trim()
    ? initialsFromName(name)
    : email
      ? email.slice(0, 2).toUpperCase()
      : "?"

  function updateDraft<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSaveProfile() {
    if (isSaving) return
    setFieldErrors({})
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Name is required")
      return
    }
    const dayRaw = draft.salaryDay.trim()
    if (!dayRaw) {
      toast.error("Salary day is required (1–31)")
      return
    }
    const day = Number(dayRaw)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      toast.error("Salary day must be a whole number between 1 and 31")
      return
    }
    const body = buildUpdateProfileBody({
      name: trimmed,
      phoneNumber: draft.phone,
      incomeType: draft.incomeType,
      company: draft.company,
      salaryDay: day,
      monthlySalary: draft.monthlySalary,
    })
    try {
      const updated = await updateMe(body).unwrap()
      dispatch(setUser(mergeAuthUserWithProfile(user, updated)))
      const next = profileUserToFormDefaults(updated)
      setName(next.name || trimmed)
      setDraft({
        phone: next.phone,
        incomeType: coerceIncomeType(next.incomeType),
        company: next.company,
        salaryDay: next.salaryDay,
        monthlySalary: next.monthlySalary,
      })
      saveProfileDraft(user.id, {
        phone: next.phone,
        incomeType: coerceIncomeType(next.incomeType),
        company: next.company,
        salaryDay: next.salaryDay,
        monthlySalary: next.monthlySalary,
      })
      toast.success("Profile saved")
    } catch (err) {
      if (isFetchBaseQueryError(err) && err.data && typeof err.data === "object") {
        const fe = parseProfileFieldErrorsFromApiData(err.data)
        if (fe) setFieldErrors(fe)
      }
      toast.error(getErrorMessage(err))
    }
  }

  function clearSessionAndRedirect() {
    endUserSession(dispatch)
    navigate("/login", { replace: true })
  }

  async function handleSignOut() {
    try {
      await logout().unwrap()
      clearSessionAndRedirect()
    } catch (error) {
      toast.error(getErrorMessage(error))
      clearSessionAndRedirect()
    }
  }

  async function handleDeleteAccount() {
    const ok = window.confirm(
      "Delete your account permanently? All your data will be removed from the server. This cannot be undone."
    )
    if (!ok) return
    try {
      const { message } = await deleteMe().unwrap()
      toast.success(message || "Your account has been deleted.")
      queueMicrotask(() => {
        endUserSession(dispatch)
        navigate("/login", { replace: true })
      })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  function handlePhotoClick() {
    toast.message("Photo upload will be available when your profile API is ready.")
  }

  return (
    <>
      <Card className="rounded-2xl border-border/80 bg-card text-card-foreground shadow-sm">
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
          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <div className="space-y-2">
              <Label htmlFor="profile-name" className={APP_FORM_LABEL_CLASS}>
                Name
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={APP_FORM_FIELD_CLASS}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className={APP_FORM_LABEL_CLASS}>
                Phone
              </Label>
              <Input
                id="profile-phone"
                value={draft.phone}
                onChange={(e) => updateDraft("phone", e.target.value)}
                placeholder="+91…"
                className={APP_FORM_FIELD_CLASS}
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phoneNumber)}
              />
              {fieldErrors.phoneNumber ? (
                <p className="text-xs text-destructive">{fieldErrors.phoneNumber}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email" className={APP_FORM_LABEL_CLASS}>
              Email
            </Label>
            <Input
              id="profile-email"
              value={email}
              readOnly
              disabled
              className={cn(APP_FORM_FIELD_CLASS, "opacity-70")}
            />
            <p className="text-xs text-muted-foreground">
              Email comes from your account. Change it when your API supports it.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-card text-card-foreground shadow-sm">
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
          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <div className="space-y-2">
              <Label htmlFor="profile-company" className={APP_FORM_LABEL_CLASS}>
                Company
              </Label>
              <Input
                id="profile-company"
                value={draft.company}
                onChange={(e) => updateDraft("company", e.target.value)}
                placeholder="Company name"
                className={APP_FORM_FIELD_CLASS}
                aria-invalid={Boolean(fieldErrors.company)}
              />
              {fieldErrors.company ? (
                <p className="text-xs text-destructive">{fieldErrors.company}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-salary-day" className={APP_FORM_LABEL_CLASS}>
                Salary day (1–31)
              </Label>
              <Input
                id="profile-salary-day"
                type="number"
                min={1}
                max={31}
                value={draft.salaryDay}
                onChange={(e) => updateDraft("salaryDay", e.target.value)}
                className={APP_FORM_FIELD_CLASS}
                aria-invalid={Boolean(fieldErrors.salaryDay)}
              />
              {fieldErrors.salaryDay ? (
                <p className="text-xs text-destructive">{String(fieldErrors.salaryDay)}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-salary" className={APP_FORM_LABEL_CLASS}>
              Monthly salary (₹)
            </Label>
            <Input
              id="profile-salary"
              inputMode="decimal"
              value={draft.monthlySalary}
              onChange={(e) => updateDraft("monthlySalary", e.target.value)}
              className={APP_FORM_FIELD_CLASS}
              aria-invalid={Boolean(fieldErrors.monthlySalary)}
            />
            {fieldErrors.monthlySalary ? (
              <p className="text-xs text-destructive">{fieldErrors.monthlySalary}</p>
            ) : null}
          </div>
          {fieldErrors.incomeType ? (
            <p className="text-xs text-destructive">{fieldErrors.incomeType}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className={APP_FORM_SUBMIT_CLASS}
          disabled={isSaving || isDeletingAccount}
          onClick={() => void handleSaveProfile()}
        >
          {isSaving ? "Saving…" : "Save profile"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={APP_FORM_SECONDARY_BTN_CLASS}
          disabled={isLogoutLoading || isDeletingAccount}
          onClick={() => void handleSignOut()}
        >
          {isLogoutLoading ? "Signing out…" : "Sign out"}
        </Button>
        <button
          type="button"
          disabled={isDeletingAccount || isLogoutLoading}
          onClick={() => void handleDeleteAccount()}
          className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-destructive hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2 className="size-4" strokeWidth={2} />
          {isDeletingAccount ? "Deleting account…" : "Delete account permanently"}
        </button>
      </div>
    </>
  )
}

function ProfileContent({ user }: { user: AuthUser }) {
  const [logout, { isLoading: isLogoutLoading }] = useLogoutMutation()
  const [updateMe, { isLoading: isSaving }] = useUpdateMeMutation()
  const [deleteMe, { isLoading: isDeletingAccount }] = useDeleteMeMutation()
  const {
    data: profileFromApi,
    isLoading: isProfileLoading,
    isError: isProfileError,
    isSuccess: isProfileSuccess,
  } = useGetMeQuery(user.id, { skip: !user })

  const formSource = resolveProfileFormSource(
    isProfileLoading,
    isProfileSuccess,
    isProfileError,
    profileFromApi
  )

  const showProfileSkeleton = formSource === null

  const initialName =
    formSource === "api" && profileFromApi
      ? profileUserToFormDefaults(profileFromApi).name || user.name || ""
      : (user.name ?? "")

  const initialDraft =
    formSource === "api" && profileFromApi
      ? profileUserToDraft(profileFromApi)
      : loadProfileDraft(user.id)

  return (
    <main className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 pb-28 [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back
      </Link>

      {showProfileSkeleton ? (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="space-y-3 border-b border-border/50 pb-4">
              <div className="flex gap-4">
                <Skeleton className="size-20 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col justify-center gap-2 pt-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full rounded-full" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
            </CardContent>
          </Card>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : (
        <ProfileForm
          key={`${user.id}-${formSource}`}
          user={user}
          initialName={initialName}
          initialDraft={initialDraft}
          updateMe={updateMe}
          deleteMe={deleteMe}
          logout={logout}
          isSaving={isSaving}
          isDeletingAccount={isDeletingAccount}
          isLogoutLoading={isLogoutLoading}
        />
      )}
    </main>
  )
}

export default function ProfilePage() {
  const user = useAppSelector((s) => s.auth.user)

  if (!user) {
    return (
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
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
