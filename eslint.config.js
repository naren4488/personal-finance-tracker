import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  eslintConfigPrettier,
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/app/router.tsx",
      /** Shared Tailwind/class strings beside the delete button component (see transaction-entry-delete-classes.ts). */
      "src/features/entries/transaction-entry-delete-classes.ts",
      "src/features/entries/transaction-entry-delete-button.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
])
