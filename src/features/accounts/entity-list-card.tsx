import type { ReactNode } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ACTION_GROUP_CARD_FOOTER } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

const shellClass = "overflow-hidden rounded-2xl border border-border bg-card shadow-sm"

const headerBtnClass =
  "w-full px-4 pb-2 pt-4 text-left transition-colors hover:bg-muted/25 sm:px-5 sm:pt-5"

const footerClass = cn(
  ACTION_GROUP_CARD_FOOTER,
  "border-t border-border/50 bg-muted/15 px-4 pb-4 pt-3 sm:px-5 sm:pb-5"
)

export function EntityListCardLetterAvatar({ letter }: { letter: string }) {
  return (
    <Avatar className="size-12 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/50">
      <AvatarFallback className="bg-transparent text-base font-bold text-primary">
        {letter}
      </AvatarFallback>
    </Avatar>
  )
}

export function EntityListCardActiveBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        active
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "text-muted-foreground"
      )}
    >
      {label ?? (active ? "Active" : "Inactive")}
    </Badge>
  )
}

export type EntityListCardShellProps = {
  onOpen: () => void
  openAriaLabel: string
  avatar: ReactNode
  title: string
  subtitle?: string | null
  metric?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  footerHint?: string | null
  className?: string
}

/** Shared My Accounts card structure: header (clickable) + optional footer strip. */
export function EntityListCardShell({
  onOpen,
  openAriaLabel,
  avatar,
  title,
  subtitle,
  metric,
  headerExtra,
  footer,
  footerHint,
  className,
}: EntityListCardShellProps) {
  return (
    <article className={cn(shellClass, className)}>
      <button type="button" onClick={onOpen} className={headerBtnClass} aria-label={openAriaLabel}>
        <div className="flex items-start gap-3">
          {avatar}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {metric ? <div className="mt-4">{metric}</div> : null}
        {headerExtra ? <div className={metric ? "mt-3" : "mt-4"}>{headerExtra}</div> : null}
      </button>
      {footer ? (
        <div className={footerClass} onClick={(e) => e.stopPropagation()} role="presentation">
          {footer}
        </div>
      ) : null}
      {footerHint ? (
        <p className="px-4 pb-3 text-xs leading-snug text-muted-foreground sm:px-5" role="status">
          {footerHint}
        </p>
      ) : null}
    </article>
  )
}

export function EntityListCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(shellClass, "p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-4 w-28 rounded-md bg-muted" />
          <div className="h-3 w-16 rounded-md bg-muted" />
        </div>
      </div>
      <div className="mt-5 h-8 w-36 rounded-md bg-muted" />
      <div className={cn("mt-4", ACTION_GROUP_CARD_FOOTER)}>
        <div className="h-7 w-14 rounded-full bg-muted" />
        <div className="h-7 w-16 rounded-full bg-muted" />
        <div className="h-7 w-16 rounded-full bg-muted" />
      </div>
    </div>
  )
}
