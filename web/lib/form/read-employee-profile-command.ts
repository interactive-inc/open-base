import { z } from "zod"

const schema = z.object({
  employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  organizationRevision: z.coerce.number().int().nonnegative(),
  personRevision: z.coerce.number().int().positive(),
  effectiveOn: z.string().date(),
  commandId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1500),
})

/** 編集画面で読んだ人物の版と、同じ操作の再送キーを取り出す。 */
export function readEmployeeProfileCommand(form: FormData) {
  const parsed = schema.safeParse({
    employeeId: form.get("profile_employee_id"),
    organizationRevision: form.get("profile_organization_revision") ?? undefined,
    personRevision: form.get("profile_person_revision") ?? undefined,
    effectiveOn: form.get("profile_effective_on"),
    commandId: form.get("profile_command_id"),
    reason: form.get("reason"),
  })
  if (!parsed.success) return new Error("人物情報を再読み込みしてから変更してください")
  return {
    commandId: parsed.data.commandId,
    reason: parsed.data.reason,
    profile: {
      employeeId: parsed.data.employeeId,
      organizationRevision: parsed.data.organizationRevision,
      personRevision: parsed.data.personRevision,
      effectiveOn: parsed.data.effectiveOn,
    },
  }
}
