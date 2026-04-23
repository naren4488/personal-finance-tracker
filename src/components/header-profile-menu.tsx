import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAppSelector } from "@/store/hooks"
import { cn } from "@/lib/utils"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function HeaderProfileMenu() {
  const user = useAppSelector((s) => s.auth.user)

  const displayName = user?.name?.trim() || user?.email || "Account"
  const email = user?.email ?? ""
  const initials = user?.name
    ? initialsFromName(user.name)
    : email
      ? email.slice(0, 2).toUpperCase()
      : "?"

  return (
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
  )
}
