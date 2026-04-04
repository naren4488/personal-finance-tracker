const PREFIX = "koin_profile_draft_"

export type IncomeType = "salaried" | "business" | "freelance"

export type ProfileDraft = {
  phone: string
  incomeType: IncomeType
  company: string
  salaryDay: string
  monthlySalary: string
}

const defaultDraft: ProfileDraft = {
  phone: "",
  incomeType: "salaried",
  company: "",
  salaryDay: "1",
  monthlySalary: "0",
}

function keyForUser(userId: string | undefined) {
  return `${PREFIX}${userId ?? "anon"}`
}

export function loadProfileDraft(userId: string | undefined): ProfileDraft {
  if (typeof window === "undefined") return { ...defaultDraft }
  try {
    const raw = localStorage.getItem(keyForUser(userId))
    if (!raw) return { ...defaultDraft }
    const parsed = JSON.parse(raw) as Partial<ProfileDraft>
    return { ...defaultDraft, ...parsed }
  } catch {
    return { ...defaultDraft }
  }
}

export function saveProfileDraft(userId: string | undefined, draft: ProfileDraft) {
  if (typeof window === "undefined") return
  localStorage.setItem(keyForUser(userId), JSON.stringify(draft))
}

/** Remove draft for one user (e.g. before sign-out if you still know `userId`). */
export function removeProfileDraft(userId: string | undefined) {
  if (typeof window === "undefined" || !userId) return
  localStorage.removeItem(keyForUser(userId))
}

/** Clear every stored profile draft (sign-out / session kill; avoids cross-user leakage on shared device). */
export function clearAllProfileDraftsFromStorage() {
  if (typeof window === "undefined") return
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX)) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}
