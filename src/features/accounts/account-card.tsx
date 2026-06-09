import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import { formatCurrency } from "@/lib/format"
import type { EntityDeleteEligibility } from "@/lib/delete/entity-delete-eligibility"
import { ACTION_GROUP_CARD_FOOTER } from "@/lib/ui/action-group-classes"
import {
  EntityListCardActiveBadge,
  EntityListCardLetterAvatar,
  EntityListCardShell,
} from "@/features/accounts/entity-list-card"
import {
  entityListCardAvatarLetter,
  entityListCardFooterBtnClass,
} from "@/features/accounts/entity-list-card-styles"
import { cn } from "@/lib/utils"

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

export type AccountCardProps = {
  account: Account
  onOpen: () => void
  /** Opens account detail with name field focused for editing. */
  onEdit: () => void
  /** Reconcile balance with bank (POST /accounts/:id/adjustments). */
  onAdjust: () => void
  /** When set, Delete opens confirmation in parent (do not delete inline). */
  onDelete?: () => void
  /** When set, disables delete if entity has transaction history. */
  deleteGuard?: EntityDeleteEligibility
}

export function AccountCard({
  account,
  onOpen,
  onEdit,
  onAdjust,
  onDelete,
  deleteGuard,
}: AccountCardProps) {
  const name = account.name?.trim() || "Account"
  const typeLabel = accountTypeDisplayLabel(account)
  const balance = accountAvailableBalanceInrFromApi(account)
  const isActive = account.isActive !== false
  const deleteBlocked = Boolean(deleteGuard?.blocked)
  const deleteHint =
    deleteGuard?.message ?? (deleteGuard?.isChecking ? "Checking transaction history…" : null)

  return (
    <EntityListCardShell
      onOpen={onOpen}
      openAriaLabel={`Open ${name}`}
      avatar={<EntityListCardLetterAvatar letter={entityListCardAvatarLetter(name)} />}
      title={name}
      subtitle={typeLabel}
      metric={
        <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">
          {formatCurrency(balance)}
        </p>
      }
      footer={
        <>
          <Button
            type="button"
            variant="default"
            size="sm"
            className={entityListCardFooterBtnClass}
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
            className={entityListCardFooterBtnClass}
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
              entityListCardFooterBtnClass,
              "border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
            )}
            disabled={deleteBlocked}
            title={deleteHint ?? undefined}
            onClick={(e) => {
              e.stopPropagation()
              if (deleteBlocked) return
              if (onDelete) onDelete()
              else comingSoon("Delete account")
            }}
          >
            Delete
          </Button>
          <EntityListCardActiveBadge active={isActive} />
        </>
      }
      footerHint={deleteHint}
    />
  )
}

export function AccountCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5",
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
