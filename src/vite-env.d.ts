/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** When `"true"`, account creation API is disabled (see `src/lib/feature-flags.ts`). */
  readonly VITE_DISABLE_ACCOUNT_CREATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
