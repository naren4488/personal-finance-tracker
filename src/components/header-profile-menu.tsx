import { Link, useNavigate } from "react-router-dom"
import { ChevronRight, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { clearToken } from "@/lib/auth/token"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearUser } from "@/store/auth-slice"
import { cn } from "@/lib/utils"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function HeaderProfileMenu() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)

  const displayName = user?.name?.trim() || user?.email || "Account"
  const email = user?.email ?? ""
  const initials = user?.name
    ? initialsFromName(user.name)
    : email
      ? email.slice(0, 2).toUpperCase()
      : "?"

  function handleSignOut() {
    clearToken()
    dispatch(clearUser())
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Link
        to="/profile"
        className={cn(
          "flex h-auto max-w-[min(140px,42vw)] items-center gap-2 rounded-xl px-2 py-1.5 text-primary-foreground",
          "hover:bg-primary-foreground/10"
        )}
        aria-label="Open profile"
      >
        <Avatar className="size-9 border-primary-foreground/25">
          <AvatarFallback className="bg-primary-foreground/20 text-xs text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{displayName}</span>
        <ChevronRight className="size-4 shrink-0 opacity-80" strokeWidth={2} />
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        aria-label="Sign out"
        onClick={handleSignOut}
      >
        <LogOut className="size-5" strokeWidth={1.5} />
      </Button>
    </div>
  )
}
