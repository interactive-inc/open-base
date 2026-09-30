import { z } from "zod"
import { companyOrganizationId } from "@/lib/api/company-organization-id"
import type { GradeDefinitionCommand } from "@/lib/api/types/grade-types"

const integer = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
  )
const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,255}$/),
    gradeId: z.string().regex(/^\S{1,255}$/),
    companyRevision: integer,
    resourceRevision: integer,
    reason: z.string().trim().min(1).max(2000),
    effectiveFrom: z.string().date(),
    effectiveTo: z
      .union([z.literal(""), z.string().date()])
      .transform((value) => (value === "" ? null : value)),
    code: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(2000),
    rank: z
      .string()
      .transform((value) => (value.trim() === "" ? null : Number(value)))
      .pipe(z.number().int().nullable()),
    description: z
      .string()
      .trim()
      .max(2000)
      .transform((value) => (value === "" ? null : value)),
  })
  .refine((value) => value.effectiveTo === null || value.effectiveTo > value.effectiveFrom)

/** 操作時に見た版・期間・理由を要求し、最新情報を自動で補完しない。 */
export function toGradeDefinitionCommand(
  form: FormData,
  operation: "create" | "update" | "cancel",
): GradeDefinitionCommand | Error {
  const parsed = schema.safeParse(
    Object.fromEntries(
      [
        "commandId",
        "gradeId",
        "companyRevision",
        "resourceRevision",
        "reason",
        "effectiveFrom",
        "effectiveTo",
        "code",
        "name",
        "rank",
        "description",
      ].map((key) => [key, form.get(key)]),
    ),
  )
  if (!parsed.success) return new Error("等級の版・有効期間・変更理由と入力内容を確認してください")
  const input = parsed.data
  if (
    (operation === "create" && input.resourceRevision !== 0) ||
    (operation !== "create" && input.resourceRevision === 0)
  )
    return new Error("等級の資源版が不正です")
  return {
    commandId: input.commandId,
    expectedRevision: input.companyRevision,
    reason: input.reason,
    resource: {
      organizationId: companyOrganizationId,
      type: "grade",
      id: input.gradeId,
      revision: input.resourceRevision + 1,
      state: operation === "cancel" ? "void" : "active",
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      attributes: {
        code: input.code,
        officialName: input.name,
        rank: input.rank,
        description: input.description,
      },
    },
  }
}
