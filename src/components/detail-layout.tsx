import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Full-height area below global shell header (omitted on detail routes); use with scrollable `main` children. */
export function DetailLayout({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-0 w-full max-w-lg flex-1 flex-col self-center overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  )
}
