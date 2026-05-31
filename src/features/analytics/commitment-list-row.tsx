import { ChevronRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { Commitment } from "@/lib/api/commitment-schemas"
import {
  commitmentEntityLinkLabel,
  resolveCommitmentRowAction,
  type EntityCatalog,
} from "@/lib/commitments/commitment-kind-config"
import { cn } from "@/lib/utils"

function formatCommitmentInr(amount: string | number): string {
  const n = Number(String(amount).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(amount)
}

type CommitmentListRowProps = {
  commitment: Commitment
  catalog?: EntityCatalog
}

export function CommitmentListRow({ commitment, catalog }: CommitmentListRowProps) {
  const navigate = useNavigate()
  const action = resolveCommitmentRowAction(commitment, catalog)
  const linkLabel = catalog ? commitmentEntityLinkLabel(commitment, catalog) : null

  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-bold text-foreground">{commitment.title}</span>
          {linkLabel ? (
            <p className="mt-0.5 truncate text-[10px] text-primary/90">{linkLabel}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs font-bold text-foreground tabular-nums">
          ₹{formatCommitmentInr(commitment.amount)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        <span>{commitment.dueDate}</span>
        <span aria-hidden>·</span>
        <span>{commitment.direction}</span>
        <span aria-hidden>·</span>
        <span>{commitment.kind}</span>
        <span aria-hidden>·</span>
        <span className="capitalize">{commitment.status}</span>
      </div>
      {commitment.note?.trim() ? (
        <p className="line-clamp-2 text-[10px] text-muted-foreground">{commitment.note.trim()}</p>
      ) : null}
    </>
  )

  if (action.type === "none") {
    return (
      <div className="flex flex-col gap-1 border-b border-border/40 py-3 last:border-0">
        {inner}
      </div>
    )
  }

  function handleClick() {
    if (action.type === "navigate") {
      navigate(action.path)
      return
    }
    if (action.type === "toast") {
      toast.error(action.message)
    }
  }

  const ariaLabel =
    action.type === "navigate"
      ? `${commitment.title}, ${action.label}`
      : `${commitment.title}, linked entity unavailable`

  return (
    <button
      type="button"
      className={cn(
        "flex w-full gap-2 border-b border-border/40 py-3 text-left last:border-0",
        "transition-colors hover:bg-muted/40 active:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <div className="min-w-0 flex-1 flex flex-col gap-1">{inner}</div>
      <ChevronRight
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
        aria-hidden
      />
    </button>
  )
}
