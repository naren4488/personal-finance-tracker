import { useCallback, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AddUdharEntrySheet } from "@/features/accounts/add-udhar-entry-sheet"
import type { UdharEntryTypeScope } from "@/features/accounts/udhar-entry-form-model"
import {
  PersonUdharAvatarTitle,
  PersonUdharLedgerList,
  PersonUdharNetAndQuadrants,
} from "@/features/accounts/person-udhar-panels"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import type { AccountsSegmentId } from "@/features/accounts/accounts-mock-data"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"
import { useGetPeopleQuery, useGetPersonLedgerQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

export default function PersonDetailPage() {
  const { personId = "" } = useParams<{ personId: string }>()
  const [searchParams] = useSearchParams()
  const accountIdFromQuery = searchParams.get("accountId")?.trim() ?? ""
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const pid = personId.trim()

  const { data: people = [] } = useGetPeopleQuery({}, { skip: !user })
  const personName = useMemo(() => {
    const p = people.find((x) => String(x.id) === pid)
    return p?.name?.trim() || "Person"
  }, [people, pid])

  const {
    data: entries = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetPersonLedgerQuery({ personId: pid, limit: 500 }, { skip: !user || !pid })

  const txDelete = useDeleteTransactionFlow()

  const [udharOpen, setUdharOpen] = useState(false)
  const [udharEntryTypeScope, setUdharEntryTypeScope] = useState<UdharEntryTypeScope>("all")
  const [udharInitialEntryType, setUdharInitialEntryType] = useState<UdharEntryType | undefined>(
    undefined
  )

  const handleUdharOpenChange = useCallback((open: boolean) => {
    setUdharOpen(open)
    if (!open) {
      setUdharEntryTypeScope("all")
      setUdharInitialEntryType(undefined)
    }
  }, [])

  /** Opens the shared Udhar form with both lend types in-form; Money Given is the default selection. */
  const openLendTakeForm = useCallback(() => {
    setUdharEntryTypeScope("lend_take")
    setUdharInitialEntryType("money_given")
    setUdharOpen(true)
  }, [])

  /** Opens the shared Udhar form with both payment types in-form; Received Back is the default selection. */
  const openRecordPaymentForm = useCallback(() => {
    setUdharEntryTypeScope("payments")
    setUdharInitialEntryType("payment_received")
    setUdharOpen(true)
  }, [])

  const backToPeople = useCallback(() => {
    navigate("/accounts", { state: { accountsSegment: "people" as AccountsSegmentId } })
  }, [navigate])

  const loadingLedger = Boolean(user && pid && (isLoading || isFetching))

  return (
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 pb-28 pt-4 [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]">
      <ConfirmDeleteDialog
        open={txDelete.confirmOpen}
        onOpenChange={(v) => !v && txDelete.dismiss()}
        title="Delete entry"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        isDeleting={txDelete.isDeleting}
        onConfirm={txDelete.confirmDelete}
      />
      <AddUdharEntrySheet
        open={udharOpen}
        onOpenChange={handleUdharOpenChange}
        initialPersonId={pid}
        initialAccountId={accountIdFromQuery || undefined}
        personContext="from_people"
        initialEntryType={udharInitialEntryType}
        entryTypeScope={udharEntryTypeScope}
      />

      <div className="space-y-4 pb-6">
        <button
          type="button"
          onClick={backToPeople}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to People
        </button>

        {!pid ? (
          <p className="text-sm text-muted-foreground">Missing person.</p>
        ) : (
          <>
            <PersonUdharAvatarTitle personName={personName} />

            {isError ? (
              <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
                <p className="text-sm text-destructive">Could not load ledger.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : loadingLedger ? (
              <div className="space-y-3" aria-busy aria-label="Loading person ledger">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                  <Skeleton className="h-20 rounded-2xl" />
                </div>
              </div>
            ) : (
              <PersonUdharNetAndQuadrants entries={entries} />
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[#071f78] font-semibold text-white hover:bg-[#071f78]/90]"
                onClick={openLendTakeForm}
              >
                Given / Taken
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-border font-semibold"
                onClick={openRecordPaymentForm}
              >
                Record Payment
              </Button>
            </div>

            {!loadingLedger && !isError ? (
              <section className="space-y-2 pt-2">
                <h3 className="text-base font-bold text-foreground">Full Ledger</h3>
                <PersonUdharLedgerList entries={entries} onDeleteEntry={txDelete.requestDelete} />
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
