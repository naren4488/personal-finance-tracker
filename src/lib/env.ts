import { z } from "zod"

/**
 * Validated public env (Vite exposes only keys prefixed with VITE_).
 * Throws at startup if values are invalid — fail fast in dev and prod builds.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "")),
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

/** Base URL for RTK Query fetchBaseQuery; trailing slashes normalized in baseApi. */
export function getApiBaseUrl(): string {
  const base = env.VITE_API_BASE_URL
  if (!base) {
    return "/api"
  }
  return base.replace(/\/$/, "")
}
