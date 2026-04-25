import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import { formatCurrency } from "@/lib/format"
import { ACTION_GROUP_CARD_FOOTER } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

function avatarLetter(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  return t.slice(0, 1).toUpperCase()
}

/** Display label for account type (e.g. `bank` → "Bank"). */
function accountTypeDisplayLabel(account: Account): string {
  const raw = `${account.kind ?? account.type ?? ""}`.trim()
  if (!raw) return "Account"
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function comingSoon(label: string) {
  toast.message("Coming soon", { description: `${label} will be available soon.` })
}

const footerBtn = "rounded-full px-3 text-xs font-semibold shadow-none sm:h-8 sm:px-3.5 sm:text-xs"

export type AccountCardProps = {
  account: Account
  onOpen: () => void
  /** Opens account detail with name field focused for editing. */
  onEdit: () => void
  /** Reconcile balance with bank (POST /accounts/:id/adjustments). */
  onAdjust: () => void
  /** When set, Delete opens confirmation in parent (do not delete inline). */
  onDelete?: () => void
}

export function AccountCard({ account, onOpen, onEdit, onAdjust, onDelete }: AccountCardProps) {
  const name = account.name?.trim() || "Account"
  const typeLabel = accountTypeDisplayLabel(account)
  const balance = accountAvailableBalanceInrFromApi(account)
  const isActive = account.isActive !== false

  return (
    <article
      className={cn(
        "rounded-2xl border border-[#E5E7EB] bg-card shadow-sm dark:border-border",
        "overflow-hidden"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 pb-2 pt-4 text-left transition-colors hover:bg-muted/25 sm:px-5 sm:pt-5"
        aria-label={`Open ${name}`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="size-12 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/50">
            <AvatarFallback className="bg-transparent text-base font-bold text-[#1e3a5f] dark:text-primary">
              {avatarLetter(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="truncate text-base font-bold tracking-tight text-[#111827] dark:text-foreground">
              {name}
            </h2>
            <p className="mt-0.5 text-sm text-[#6B7280] dark:text-muted-foreground">{typeLabel}</p>
          </div>
        </div>
        <p className="mt-4 text-2xl font-bold tabular-nums tracking-tight text-[#111827] dark:text-foreground sm:text-[1.75rem]">
          {formatCurrency(balance)}
        </p>
      </button>

      <div
        className={cn(
          ACTION_GROUP_CARD_FOOTER,
          "border-t border-border/50 bg-muted/15 px-4 pb-4 pt-3 sm:px-5 sm:pb-5"
        )}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <Button
          type="button"
          variant="default"
          size="sm"
          className={footerBtn}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={footerBtn}
          onClick={(e) => {
            e.stopPropagation()
            onAdjust()
          }}
        >
          Adjust
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            footerBtn,
            "border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
          )}
          onClick={(e) => {
            e.stopPropagation()
            if (onDelete) onDelete()
            else comingSoon("Delete account")
          }}
        >
          Delete
        </Button>
        <Badge
          variant="outline"
          className={cn(
            "h-7 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isActive
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "text-muted-foreground"
          )}
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </div>
    </article>
  )
}

export function AccountCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E5E7EB] bg-card p-4 shadow-sm dark:border-border sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
      <Skeleton className="mt-5 h-8 w-36 rounded-md" />
      <div className={cn("mt-4", ACTION_GROUP_CARD_FOOTER)}>
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
    </div>
  )
}
