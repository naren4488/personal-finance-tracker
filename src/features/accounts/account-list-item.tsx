import type { Account } from "@/lib/api/account-schemas"
import { AccountCard } from "@/features/accounts/account-card"
import { useAccountDeleteGuard } from "@/hooks/use-account-delete-guard"

export type AccountListItemProps = {
  account: Account
  onOpen: () => void
  onEdit: () => void
  onAdjust: () => void
  onDelete: () => void
}

/** Account row with frontend delete guard (ledger probe, limit 1). */
export function AccountListItem({
  account,
  onOpen,
  onEdit,
  onAdjust,
  onDelete,
}: AccountListItemProps) {
  const deleteGuard = useAccountDeleteGuard(String(account.id ?? ""), "account")

  return (
    <AccountCard
      account={account}
      onOpen={onOpen}
      onEdit={onEdit}
      onAdjust={onAdjust}
      onDelete={onDelete}
      deleteGuard={deleteGuard}
    />
  )
}
