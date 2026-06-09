/**
 * Shared INR scalar parsing for API payloads and display formatting.
 * Use the variant that matches the previous local helper semantics in each callsite.
 */

/** `unknown` API field → finite number; missing/invalid → `0` (comma strip + trim). */
export function parseInrFromUnknown(raw: unknown): number {
  if (raw === undefined || raw === null) return 0
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  if (typeof raw === "string") {
    const n = Number(String(raw).replace(/,/g, "").trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** `unknown` API field → finite number; also strips internal whitespace before parse. */
export function parseInrFromUnknownStripSpaces(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const n = Number(raw.replace(/,/g, "").replace(/\s/g, "").trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Known `number | string` scalar (forms, display); invalid → `0`. */
export function parseInrScalar(raw: number | string): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  const n = Number(String(raw).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}
