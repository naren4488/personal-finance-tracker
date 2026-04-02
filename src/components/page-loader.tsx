import { Skeleton } from "@/components/ui/skeleton"

export function PageLoader() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
