import { cn } from "@/lib/utils"

/** Highlight invalid manual form fields (non-RHF). */
export function fieldWithErrorClass(className: string, hasError: boolean): string {
  return cn(className, hasError && "border-destructive focus-visible:ring-destructive/30")
}
