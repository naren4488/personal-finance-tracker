/** Last active Entries tab — used by global FAB when navigating from Home etc. */
export const ENTRIES_LAST_SEGMENT_KEY = "koin:entriesLastSegment"

/** Dispatched on `/entries` so the floating + opens the form for the current tab. */
export const ENTRIES_FAB_OPEN_EVENT = "koin:entries-fab-open-add"

/** `?add=txns|expenses|transfer|udhar` — opens that tab’s add flow after navigation. */
export const ENTRIES_ADD_SEARCH_PARAM = "add"

export type EntryAddQueryValue = "txns" | "expenses" | "transfer" | "udhar"

export function getLastEntriesSegmentForFab(): EntryAddQueryValue {
  try {
    const v = sessionStorage.getItem(ENTRIES_LAST_SEGMENT_KEY)
    if (v === "txns" || v === "expenses" || v === "transfer" || v === "udhar") return v
  } catch {
    /* ignore */
  }
  return "txns"
}
