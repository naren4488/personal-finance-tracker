import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

type Mode = "login" | "register"

export function AuthModeToggle({ mode }: { mode: Mode }) {
  return (
    <div className="flex w-full rounded-full bg-muted/80 p-1 ring-1 ring-border/40">
      <Link
        to="/login"
        className={cn(
          "flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-all",
          mode === "login"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Login
      </Link>
      <Link
        to="/register"
        className={cn(
          "flex-1 rounded-full py-2.5 text-center text-sm font-medium transition-all",
          mode === "register"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Sign Up
      </Link>
    </div>
  )
}
