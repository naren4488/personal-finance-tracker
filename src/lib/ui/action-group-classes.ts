/**
 * Shared flex alignment for small action controls (Delete, Edit, Adjust, etc.).
 * Use row for horizontal groups, col when actions stack vertically.
 */
export const ACTION_GROUP_ROW = "flex flex-row flex-wrap items-center justify-center gap-2"

/**
 * Account card footer strip: full width, actions centered left–right in the footer.
 */
export const ACTION_GROUP_CARD_FOOTER =
  "flex w-full min-w-0 flex-row flex-wrap items-center justify-center gap-2"

/** People row: action cluster on the right; use with parent `items-center` to center it top–bottom on the right. */
export const ACTION_GROUP_CARD_RAIL =
  "flex shrink-0 flex-row flex-wrap items-center justify-end gap-2"

/** Delete + amount groups on transaction / ledger rows (slightly wider gap than {@link ACTION_GROUP_ROW}). */
export const ACTION_GROUP_ROW_TX = "flex flex-row flex-wrap items-center justify-center gap-[11px]"

export const ACTION_GROUP_COL = "flex flex-col items-center justify-center gap-2"
