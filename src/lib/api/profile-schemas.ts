import { z } from "zod"

/** Full user row from GET/PUT `/users/me` `data.user`. */
export const profileUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string().optional(),
    phoneNumber: z.string().optional(),
    incomeType: z.string().optional(),
    company: z.string().optional(),
    salaryDay: z.union([z.number(), z.string()]).optional(),
    monthlySalary: z.union([z.number(), z.string()]).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

export type ProfileUser = z.infer<typeof profileUserSchema>

const profileSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    user: profileUserSchema,
  }),
})

export function parseProfileSuccessEnvelope(
  raw: unknown
): { ok: true; user: ProfileUser } | { ok: false; error: string } {
  const parsed = profileSuccessEnvelopeSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid profile response from server." }
  }
  return { ok: true, user: parsed.data.data.user }
}

/** PUT `/users/me` JSON body (amounts as string per API). */
export const updateProfileRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  phoneNumber: z.string(),
  incomeType: z.string().min(1),
  company: z.string(),
  salaryDay: z.number().int().min(1).max(31),
  monthlySalary: z.string().min(1),
})

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

export function buildUpdateProfileBody(input: {
  name: string
  phoneNumber: string
  incomeType: string
  company: string
  salaryDay: number
  monthlySalary: string
}): UpdateProfileRequest {
  const salary = input.monthlySalary.trim() || "0"
  const num = Number(salary.replace(/,/g, ""))
  const monthlySalary = Number.isFinite(num) ? num.toFixed(2) : "0.00"
  return {
    name: input.name.trim(),
    phoneNumber: input.phoneNumber.trim(),
    incomeType: input.incomeType.trim() || "salaried",
    company: input.company.trim(),
    salaryDay: input.salaryDay,
    monthlySalary,
  }
}

export function profileUserToFormDefaults(user: ProfileUser): {
  name: string
  phone: string
  incomeType: string
  company: string
  salaryDay: string
  monthlySalary: string
} {
  const sd = user.salaryDay
  const salaryDay =
    sd === undefined || sd === null || sd === ""
      ? ""
      : typeof sd === "number"
        ? String(sd)
        : String(sd)

  const ms = user.monthlySalary
  let monthlySalary = ""
  if (ms !== undefined && ms !== null && ms !== "") {
    monthlySalary = typeof ms === "number" ? String(ms) : String(ms)
  }

  return {
    name: user.name?.trim() ?? "",
    phone: user.phoneNumber?.trim() ?? "",
    incomeType: user.incomeType?.trim() ?? "",
    company: user.company?.trim() ?? "",
    salaryDay,
    monthlySalary,
  }
}
