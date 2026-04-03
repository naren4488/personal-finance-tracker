import { z } from "zod"

/** POST /auth/register — exact JSON body */
export const registerRequestSchema = z.object({
  name: z.string().min(3, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password is required"),
})

export type RegisterRequest = z.infer<typeof registerRequestSchema>

/** POST /auth/login — exact JSON body */
export const loginRequestSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password is required"),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

/** Backend error envelope */
export const apiFailureSchema = z.object({
  success: z.literal(false),
  message: z.string(),
})

export type ApiFailure = z.infer<typeof apiFailureSchema>

/** User object from register/login success `data.user` */
export const authUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

export type AuthUser = z.infer<typeof authUserSchema>

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.string(),
})

/** Same envelope for successful register and login */
export const authSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    user: authUserSchema,
    tokens: authTokensSchema,
  }),
})

export type AuthSuccessResponse = z.infer<typeof authSuccessResponseSchema>

/** Normalized result after successful register or login */
export type AuthResult = {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

/** @deprecated use AuthResult */
export type LoginResult = AuthResult

export function parseAuthSuccessResponse(
  raw: unknown
): { ok: true; result: AuthResult } | { ok: false; error: string } {
  const parsed = authSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  const { user, tokens } = parsed.data.data
  return {
    ok: true,
    result: {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  }
}

export function parseApiFailureMessage(data: unknown): string | null {
  const p = apiFailureSchema.safeParse(data)
  return p.success ? p.data.message : null
}

/** POST /auth/logout — success envelope */
export const logoutSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
})

export type LogoutSuccess = z.infer<typeof logoutSuccessResponseSchema>

export function parseLogoutSuccess(
  raw: unknown
): { ok: true; message: string } | { ok: false; error: string } {
  const parsed = logoutSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  return { ok: true, message: parsed.data.message }
}
