import { useNavigate } from "react-router-dom"
import { ChevronDown, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

  function handleLogout() {
    clearToken()
    dispatch(clearUser())
    navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto max-w-[140px] gap-2 rounded-xl px-2 py-1.5 text-primary-foreground",
            "hover:bg-primary-foreground/10 hover:text-primary-foreground"
          )}
          aria-label="Open account menu"
        >
          <Avatar className="size-9 border-primary-foreground/25">
            <AvatarFallback className="bg-primary-foreground/20 text-xs text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {displayName}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-80" strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut className="size-4" strokeWidth={2} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
