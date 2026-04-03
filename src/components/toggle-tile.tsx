import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ToggleTile({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center justify-center gap-1 rounded-xl border-2 px-1.5 py-1.5 text-center text-[11px] font-medium leading-tight transition-colors sm:min-h-10 sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs md:text-[13px]",
        selected
          ? "border-primary bg-sky-50 text-primary dark:bg-primary/15"
          : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
