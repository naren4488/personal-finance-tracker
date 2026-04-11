import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional title; defaults to "Delete" */
  title?: string
  /** Main confirmation copy */
  message?: string
  /** Extra warning (e.g. non-zero balance) shown in an amber callout */
  warning?: string | null
  cancelLabel?: string
  confirmLabel?: string
  isDeleting?: boolean
  onConfirm: () => void | Promise<void>
}

const defaultMessage = "Are you sure you want to delete this?"

/**
 * Reusable confirmation for destructive account (and similar) deletes.
 * Does not perform the API call — parent handles that in `onConfirm`.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Delete",
  message = defaultMessage,
  warning,
  cancelLabel = "Cancel",
  confirmLabel = "Delete",
  isDeleting = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => !isDeleting && onOpenChange(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <h2 id="confirm-delete-title" className="text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id="confirm-delete-desc" className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
        {warning ? (
          <p
            className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
            role="status"
          >
            {warning}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
          >
            {isDeleting ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
