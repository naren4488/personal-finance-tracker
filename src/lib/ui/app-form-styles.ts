import { cn } from "@/lib/utils"

/**
 * Canonical layout + field styles for FormDialog flows (Add Transaction, account sheets, etc.).
 * Import from here for new code; `tx-modal-form-classes` re-exports `TX_*` aliases for compatibility.
 */

export const APP_FORM_HEADER_CLASS = "shrink-0 border-b border-border/80 bg-card px-5 py-4"

export const APP_FORM_TITLE_CLASS = "text-base font-bold text-primary sm:text-lg"

export const APP_FORM_DESCRIPTION_CLASS =
  "mt-2 text-center text-xs leading-relaxed text-muted-foreground sm:text-sm"

/** Vertical rhythm + horizontal padding inside modal scroll body. */
export const APP_FORM_STACK_CLASS = "space-y-4 px-5 py-5"

/** @deprecated Prefer APP_FORM_STACK_CLASS */
export const APP_FORM_FIELDS_STACK_CLASS = APP_FORM_STACK_CLASS

export const APP_FORM_FOOTER_CLASS = cn(
  "relative z-10 shrink-0 border-t border-border/80 bg-card px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
  "shadow-[0_-10px_40px_-18px_rgba(15,23,42,0.14)] dark:shadow-[0_-10px_40px_-18px_rgba(0,0,0,0.5)]",
  "sm:px-4 sm:py-2.5 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
)

export const APP_FORM_LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-foreground/80"

/** Uppercase section title (e.g. “Account type”) — distinct from field labels. */
export const APP_FORM_SECTION_HEADING_CLASS =
  "mb-2 block text-xs font-bold uppercase tracking-wide text-primary/90 sm:text-[13px] sm:font-semibold sm:normal-case sm:tracking-normal sm:text-foreground/90"

export const APP_FORM_FIELD_CLASS = cn(
  "flex h-10 w-full min-h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
  "placeholder:text-muted-foreground/60",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-50"
)

export const APP_FORM_SELECT_CLASS = cn(APP_FORM_FIELD_CLASS, "appearance-none pr-9")

/** Large centered balance / opening amount (non-primary border). */
export const APP_FORM_FIELD_EMPHASIS_CLASS = cn(
  APP_FORM_FIELD_CLASS,
  "h-12 min-h-12 justify-center text-center text-lg font-semibold tabular-nums text-primary placeholder:text-primary/40 sm:h-14 sm:text-xl"
)

/** Hero amount row (border-primary) — loan payment, card payment, card spend. */
export const APP_FORM_AMOUNT_PRIMARY_CLASS = cn(
  "h-12 min-h-12 w-full rounded-xl border-2 border-primary bg-card px-3 text-center text-lg font-bold tabular-nums shadow-sm sm:h-14 sm:text-xl",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto"
)

export const APP_FORM_TEXTAREA_CLASS = cn(APP_FORM_FIELD_CLASS, "min-h-14 resize-y py-2")

export const APP_FORM_TWO_COL_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2"

export const APP_FORM_THREE_COL_GRID_CLASS = "grid grid-cols-3 gap-3"

/** Primary submit — muted purple-blue (`hsl(230 22% 62%)` ≈ #8A94B7). */
export const APP_FORM_SUBMIT_CLASS = cn(
  "h-10 min-h-10 w-full rounded-xl text-sm font-bold text-white shadow-none",
  "bg-[hsl(230_22%_62%)] hover:bg-[hsl(230_22%_56%)] active:scale-[0.99]",
  "disabled:pointer-events-none disabled:opacity-60 sm:h-11 sm:text-base"
)

export const APP_FORM_SECONDARY_BTN_CLASS = cn(
  "h-10 min-h-10 w-full rounded-xl border border-border bg-background text-sm font-semibold text-foreground",
  "shadow-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50 sm:h-11"
)

/** Panel shell matching FormDialog-style card on page. */
export const APP_FORM_PANEL_CLASS = cn(
  "mt-4 flex max-h-[min(70dvh,32rem)] flex-col overflow-hidden rounded-2xl border border-border/90 bg-card",
  "shadow-[0_25px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-black/5 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:ring-white/10"
)

export const APP_FORM_SWITCH_ROW_CLASS = cn(
  "flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3.5 sm:px-5 sm:py-4",
  "shadow-sm"
)
