export const ANALYTICS_COMMITMENTS_SECTION_ID = "analytics-commitments"

/** Scroll the Analytics commitments block into view and move focus for accessibility. */
export function scrollToCommitmentsSection(): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(ANALYTICS_COMMITMENTS_SECTION_ID)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    if (typeof el.focus === "function") {
      el.focus({ preventScroll: true })
    }
    const list = el.querySelector('[aria-label="Commitments list"]')
    if (list instanceof HTMLElement) {
      list.scrollTop = 0
    }
  })
}
