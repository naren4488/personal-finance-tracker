# Scalable frontend setup — what to consider

This document lists decisions and tools worth considering when growing a React + Vite app (like Koin / this finance tracker) into a maintainable production codebase. Nothing here is mandatory; pick what matches your team size, backend shape, and complexity.

---

## 1. Type safety end-to-end

| Topic                        | Why it matters                                      | Common choices                                                       |
| ---------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| **Strict TypeScript**        | Catches bugs at compile time; documents APIs        | `strict`, `noUncheckedIndexedAccess` (stricter), path aliases (`@/`) |
| **Runtime validation**       | APIs and forms lie; TS only validates at build time | **Zod**, Valibot, ArkType                                            |
| **Infer types from schemas** | Single source of truth                              | `z.infer<typeof Schema>` for props, API DTOs, form values            |
| **OpenAPI / contract-first** | Keeps frontend and backend aligned                  | Orval, openapi-typescript, tRPC (if full-stack TS)                   |

**Zod** fits well for: env vars (`zod`-validated `import.meta.env`), form + server payloads, parsing JSON from `fetch`, and colocating rules with UI error messages.

---

## 2. State management — split by responsibility

| Layer                 | Responsibility                                         | Typical tools                                                    |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| **Server state**      | Cached API data, loading/error, refetch, deduplication | **TanStack Query (React Query)**, SWR, RTK Query                 |
| **Client / UI state** | Theme, sidebar, modals, wizard steps, selected tab     | **Zustand**, Jotai, React context (sparingly), **Redux Toolkit** |
| **URL state**         | Shareable filters, pagination, deep links              | React Router (or TanStack Router) search params                  |
| **Form state**        | Field values, validation, dirty/touched                | React Hook Form + Zod resolver, TanStack Form                    |

**Redux / Redux Toolkit** shines when: many features share complex state, you need time-travel debugging, middleware (analytics, persistence), or strict unidirectional patterns across a large team. For many apps, **React Query + a small Zustand (or Context) slice** is enough and less boilerplate.

**Avoid** putting remote data in Redux unless you have a clear reason — duplication and sync issues are common.

---

## 3. Routing and code organization

| Topic               | Notes                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Router**          | **React Router** (widest adoption) or **TanStack Router** (strong types, search-param schemas)                |
| **Layouts**         | Nested routes for shell (header, nav) vs full-screen (auth)                                                   |
| **Lazy routes**     | `React.lazy` + `Suspense` per major route to shrink initial bundle                                            |
| **Feature folders** | e.g. `features/transactions/`, `features/accounts/` with components, hooks, api — not only `components/` flat |
| **Shared UI**       | `components/ui/` (design system primitives), `lib/` (utils, clients)                                          |

---

## 4. Data fetching and API boundary

- **Single API module** or **per-feature clients** with typed responses (Zod parse after `fetch`).
- **Error normalization**: map HTTP errors to a small union type the UI can branch on.
- **Auth**: attach tokens in one place (interceptor or wrapper around `fetch`); refresh flow documented.
- **Idempotency / optimistic updates**: decide per mutation; React Query supports both.
- **Pagination / infinite scroll**: cursor vs offset; align with backend.

---

## 5. Forms and validation

- **React Hook Form** (or similar) for performance and less re-rendering on large forms.
- **Zod** schemas shared between client validation and (ideally) documented server contract.
- **Accessible errors**: `aria-invalid`, `aria-describedby`, focus management on submit failure.

---

## 6. Styling and design system

- **Design tokens** (CSS variables + Tailwind `@theme`) — already aligned with Koin.
- **Component primitives**: consistent Button, Input, Card, Dialog (e.g. Radix + your wrappers).
- **Dark mode**: class on `html` + tested contrast (`next-themes` or equivalent).
- **No magic numbers** in components where tokens exist (spacing, radius, colors).

---

## 7. Testing strategy

| Level           | Purpose                           | Tools (examples)               |
| --------------- | --------------------------------- | ------------------------------ |
| **Unit**        | Pure functions, utils, formatters | Vitest                         |
| **Component**   | UI behavior, a11y                 | Vitest + React Testing Library |
| **Integration** | Forms + API mocks                 | MSW (Mock Service Worker)      |
| **E2E**         | Critical user paths               | Playwright, Cypress            |

Start with **Vitest + RTL** and a few **Playwright** smoke tests; add MSW when API coupling hurts.

---

## 8. Linting, formatting, git hooks

- **ESLint** + **TypeScript ESLint**; React Compiler rules if you use the compiler.
- **Prettier** (or Biome) for consistent formatting.
- **Husky + lint-staged** (or **lefthook**) to run lint/format on staged files.
- **Commit conventions** (optional): Conventional Commits for changelogs.

---

## 9. Build, env, and configuration

- **`.env` discipline**: never commit secrets; validate with Zod at startup.
- **`import.meta.env` types**: extend `vite/client` interfaces for typed env keys.
- **Bundle analysis**: `rollup-plugin-visualizer` or Vite plugin — watch for duplicate deps and huge icons/charts.
- **Source maps** in production: policy per privacy/security needs.

---

## 10. Error handling and resilience

- **React error boundary** at route or layout level; fallback UI + reporting hook.
- **Query error boundaries** or global React Query `onError` → toast + logging.
- **Offline / slow network**: stale data policy, skeletons, retry strategy (React Query `retry`).

---

## 11. Performance

- **Memoization** where profiling shows benefit — avoid premature `useMemo`/`memo`.
- **List virtualization** for long transaction lists (`@tanstack/react-virtual`).
- **Image optimization** if you add user uploads or rich marketing assets.
- **Code splitting** by route and heavy libraries (charts, editors).

---

## 12. Security (frontend-facing)

- **XSS**: avoid `dangerouslySetInnerHTML`; sanitize if required.
- **CSRF**: cookies + mutations — follow backend requirements.
- **Sensitive data in memory**: be careful with logging state; redact in error reports.
- **Dependencies**: `npm audit`, Dependabot/Renovate, lockfile in repo.

---

## 13. Accessibility (a11y)

- Keyboard navigation, focus order, visible focus rings.
- Semantic HTML + labels for inputs.
- **eslint-plugin-jsx-a11y** in CI.
- Occasional **axe** checks in E2E or Storybook.

---

## 14. Internationalization (i18n)

- If you outgrow `en-IN` only: **react-i18next**, Lingui, or Paraglide — extract strings early if expansion is likely.

---

## 15. Observability

- **Product analytics** (privacy-compliant): event naming conventions.
- **Error tracking**: Sentry, etc., with release + user context.
- **Web Vitals** (optional): report LCP/CLS to your analytics pipeline.

---

## 16. Documentation in the repo

- **README**: how to run, env vars, scripts.
- **ADR (Architecture Decision Records)**: short markdown files for “why we chose X”.
- **Storybook** or **Ladle** (optional): living docs for UI components.

---

## 17. Suggested stack tiers (practical)

**Lean (good default for this app)**

- TypeScript strict + Zod
- TanStack Query + Zustand (or small Context)
- React Router + React Hook Form
- Vitest + RTL + a few Playwright tests
- ESLint + Prettier + lint-staged

**Heavier (large team / complex client state)**

- Everything above, plus **Redux Toolkit** for slices that truly need global transactional state
- RTK Query _or_ keep React Query — usually not both without a clear split
- Stricter governance: CODEOWNERS, ADRs, Storybook

---

## 18. What _not_ to add prematurely

- Redux for purely server data
- Abstraction layers (“enterprise folder trees”) before you have 2+ similar features
- Micro-frontends unless org scale demands it
- Every possible devtool on day one — add when pain appears

---

## Quick checklist before calling the setup “production-grade”

- [ ] Strict TS, no implicit `any` in new code
- [ ] Env validated (e.g. Zod)
- [ ] Server state separated from UI state
- [ ] Router with lazy-loaded major routes
- [ ] Error boundary + user-visible error states
- [ ] Tests for critical paths and formatters
- [ ] Lint + typecheck in CI
- [ ] Documented runbook in README

---

_Last updated: April 2026 — adjust tool versions and choices as the ecosystem evolves._
