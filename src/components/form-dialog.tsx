import * as React from "react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import { cn } from "@/lib/utils"

export type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Announced to assistive tech; must match the visible heading in `header`. */
  accessibilityTitle: string
  header: React.ReactNode
  /** Scrollable body — use inner wrappers for field spacing. */
  children: React.ReactNode
  /** Omit or pass `null` to hide the footer strip (e.g. loading state). */
  footer?: React.ReactNode | null
  /** Merged onto the footer container (border, padding, etc.). */
  footerClassName?: string
  /** Extra classes on the dialog panel (e.g. `max-w-xl`). */
  contentClassName?: string
  /** When set, body and footer are wrapped in `<form>` with these props. */
  formProps?: React.ComponentProps<"form">
}

/**
 * Top-anchored floating panel: header + scrollable body + elevated footer.
 * Footer stays at the bottom of the panel when content is short (column flex).
 */
export function FormDialog({
  open,
  onOpenChange,
  accessibilityTitle,
  header,
  children,
  footer,
  footerClassName,
  contentClassName,
  formProps,
}: FormDialogProps) {
  const showFooter = footer != null

  const footerEl = showFooter ? (
    <div className={cn(FORM_OVERLAY_FOOTER, "px-4", footerClassName)}>{footer}</div>
  ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-[calc(100%-1rem)] max-w-lg flex-col rounded-2xl border border-border/90 bg-card p-0 duration-200 sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "shadow-[0_25px_50px_-12px_rgba(15,23,42,0.28)] ring-1 ring-black/5 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] dark:ring-white/10",
          "left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] -translate-x-1/2 translate-y-0",
          "animate-in fade-in zoom-in-95",
          contentClassName,
          /* Caller max-width/rounding last; clamp must keep flex + overflow intact */
          "min-h-0 flex flex-col overflow-hidden"
        )}
      >
        {/*
          Radix requires DialogTitle as a direct child of DialogContent for a11y.
          Visible title stays in `header` as <h2>; this duplicate is sr-only for AT.
        */}
        <DialogTitle className="sr-only">{accessibilityTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          Use the form below; footer actions save or dismiss this dialog.
        </DialogDescription>
        <div className="shrink-0">{header}</div>

        {formProps ? (
          <form
            {...formProps}
            className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", formProps.className)}
          >
            <div className={FORM_OVERLAY_SCROLL_BODY}>{children}</div>
            {footerEl}
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={FORM_OVERLAY_SCROLL_BODY}>{children}</div>
            {footerEl}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
