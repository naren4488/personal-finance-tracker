import { z } from "zod"
import {
  COMMITMENT_KIND_VALUES,
  getCommitmentKindDef,
  PAYABLE_COMMITMENT_STATUSES,
  validateCommitmentEntity,
  type CommitmentDirection,
  type CommitmentKindValue,
  type PayableCommitmentStatus,
} from "@/lib/commitments/commitment-kind-config"
import { parsePositiveDecimal } from "@/lib/forms/zod-helpers"

export const commitmentFormSchema = z
  .object({
    direction: z.enum(["payable", "incoming"]),
    kind: z.enum(COMMITMENT_KIND_VALUES),
    title: z.string().min(1, "Enter a title"),
    amount: z
      .string()
      .min(1, "Enter a valid amount")
      .refine((s) => parsePositiveDecimal(s) != null, "Enter a valid amount"),
    dueDate: z.string().min(1, "Select due date"),
    status: z.string().optional(),
    entityId: z.string(),
    note: z.string(),
  })
  .superRefine((data, ctx) => {
    const entityError = validateCommitmentEntity(data.kind, data.entityId)
    if (entityError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: entityError,
      })
    }

    if (data.direction === "payable") {
      const status = data.status?.trim() ?? ""
      if (!status) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: "Select status",
        })
      } else if (!PAYABLE_COMMITMENT_STATUSES.includes(status as PayableCommitmentStatus)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: "Select status",
        })
      }
    }
  })

export type CommitmentFormValues = z.infer<typeof commitmentFormSchema>

export function commitmentFormDefaultValues(): CommitmentFormValues {
  const defaultKind = COMMITMENT_KIND_VALUES[0]
  const def = getCommitmentKindDef(defaultKind)
  const direction = def.defaultDirection as CommitmentDirection
  return {
    direction,
    kind: defaultKind as CommitmentKindValue,
    title: "",
    amount: "",
    dueDate: todayIsoDate(),
    status: direction === "payable" ? "pending" : undefined,
    entityId: "",
    note: "",
  }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
