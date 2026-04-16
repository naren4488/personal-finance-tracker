/**
 * Middle section of modal/sheet forms: fills remaining height and scrolls vertically
 * when content overflows. Pair with `shrink-0` header + FORM_OVERLAY_FOOTER.
 */
export const FORM_OVERLAY_SCROLL_BODY =
  "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-smooth [scrollbar-width:thin] pb-4"

/**
 * Fills remaining modal height without a scroll container — use for short/empty/centered
 * content so `overflow-y-auto` does not show a scrollbar when nothing overflows.
 */
export const FORM_OVERLAY_FILL_BODY = "min-h-0 flex-1 flex flex-col overflow-hidden"

/**
 * Fixed action bar at the bottom of a sheet/modal: stays above the app chrome, never clipped
 * by the scroll area. Use below a FORM_OVERLAY_SCROLL_BODY sibling inside a flex column form.
 */
export const FORM_OVERLAY_FOOTER =
  "relative z-20 shrink-0 border-t border-border bg-card px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-18px_rgba(15,23,42,0.14)] dark:shadow-[0_-10px_40px_-18px_rgba(0,0,0,0.5)] sm:px-4 sm:py-2.5 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
