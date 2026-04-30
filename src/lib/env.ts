import { z } from "zod"

/** Used when `VITE_API_BASE_URL` is unset (e.g. Vercel without env) — same as `.env.example`. */
const DEFAULT_VITE_API_BASE_URL = "https://expensetracker-api.lazycoderz.com/api/v1"

/**
 * Validated public env (Vite exposes only keys prefixed with VITE_).
 * Throws at startup if values are invalid — fail fast in dev and prod builds.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v : DEFAULT_VITE_API_BASE_URL),
    z
      .string()
      .url("VITE_API_BASE_URL must be a valid URL")
      .transform((s) => s.replace(/\/+$/, ""))
  ),
  MODE: z.string(),
  DEV: z.boolean(),
  PROD: z.boolean(),
})

function readEnv() {
  return {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL as string | undefined,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  }
}

export const env = envSchema.parse(readEnv())

/** Central API base URL used by every HTTP request. */
export const BASE_URL = env.VITE_API_BASE_URL

/** Kept for backwards compatibility with existing imports. */
export function getApiBaseUrl(): string {
  return BASE_URL
}
