/** Matches My Accounts card action buttons in the footer strip. */
export const entityListCardFooterBtnClass =
  "rounded-full px-3 text-xs font-semibold shadow-none sm:h-8 sm:px-3.5 sm:text-xs"

export function entityListCardAvatarLetter(name: string): string {
  const t = name.trim()
  if (!t) return "?"
  return t.slice(0, 1).toUpperCase()
}
