import { z } from "zod"

export const createPersonRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().optional(),
})

export type CreatePersonRequest = z.infer<typeof createPersonRequestSchema>

export const personSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phoneNumber: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()

export type Person = z.infer<typeof personSchema>

export const createPersonSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    person: personSchema,
  }),
})

export function parseCreatePersonSuccess(
  raw: unknown
): { ok: true; person: Person } | { ok: false; error: string } {
  const parsed = createPersonSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  return { ok: true, person: parsed.data.data.person }
}

export const getPeopleSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    people: z.array(personSchema),
  }),
})

export type GetPeopleSuccessData = z.infer<typeof getPeopleSuccessResponseSchema>["data"]

export function parseGetPeopleSuccess(
  raw: unknown
): { ok: true; data: GetPeopleSuccessData } | { ok: false; error: string } {
  const parsed = getPeopleSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  return { ok: true, data: parsed.data.data }
}
