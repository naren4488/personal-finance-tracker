import { z, type ZodError } from "zod"

export function parsePositiveDecimal(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function parseNonNegativeDecimal(raw: string | undefined): number | null {
  const t = (raw ?? "").replace(/,/g, "").trim()
  if (!t) return 0
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export const isoDateString = z
  .string()
  .min(1, "Select date")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")

export function zodErrorToFieldMap(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".")
    if (path && !out[path]) {
      out[path] = issue.message
    }
  }
  return out
}

export function firstZodIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid value"
}
