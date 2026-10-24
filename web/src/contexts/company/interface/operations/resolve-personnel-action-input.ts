import type { PersonnelPositionReference } from "@/contexts/company/domain/definitions/personnel-position-reference.definition"
import {
  nonCorrectionPersonnelActionInputSchema,
  personnelActionInputSchema,
  type PersonnelActionInput,
} from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import {
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const code = z.string().trim().min(1).max(64)
const date = z.string().date()
const eventFields = { employeeCode: code, eventOn: date }
const assignmentFields = {
  departmentCode: code,
  positionCode: code.nullable(),
  managerEmployeeCode: code.nullable(),
}
const assignmentTargetFields = {
  departmentCode: code,
  assignmentType: z.enum(["primary", "concurrent"]),
}
const hire = z.strictObject({
  kind: z.literal("hire"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
  employeeCode: code,
  employeeName: z.string().trim().min(1).max(200),
  eventOn: date,
  departmentCode: code.nullable().optional(),
  positionCode: code.nullable().optional(),
  managerEmployeeCode: code.nullable().optional(),
})
const rehire = z.strictObject({
  kind: z.literal("rehire"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
  ...eventFields,
  departmentCode: code.nullable().optional(),
  positionCode: code.nullable().optional(),
  managerEmployeeCode: code.nullable().optional(),
})
const primaryAssignmentStarted = z.strictObject({
  kind: z.literal("primary_assignment_started"),
  ...eventFields,
  ...assignmentFields,
})
const transferred = z.strictObject({
  kind: z.literal("transferred"),
  ...eventFields,
  ...assignmentFields,
})
const concurrentAssignmentStarted = z.strictObject({
  kind: z.literal("concurrent_assignment_started"),
  ...eventFields,
  ...assignmentFields,
})
const assignmentEnded = z.strictObject({
  kind: z.literal("assignment_ended"),
  ...eventFields,
  ...assignmentTargetFields,
})
const positionChanged = z.strictObject({
  kind: z.literal("position_changed"),
  ...eventFields,
  ...assignmentTargetFields,
  positionCode: code,
  changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
})
const managerChanged = z.strictObject({
  kind: z.literal("manager_changed"),
  ...eventFields,
  ...assignmentTargetFields,
  managerEmployeeCode: code.nullable(),
})
const departmentResponsibilityStarted = z.strictObject({
  kind: z.literal("department_responsibility_started"),
  ...eventFields,
  departmentCode: code,
})
const departmentResponsibilityEnded = z.strictObject({
  kind: z.literal("department_responsibility_ended"),
  ...eventFields,
  departmentCode: code,
})
const leaveStarted = z.strictObject({ kind: z.literal("leave_started"), ...eventFields })
const returned = z.strictObject({ kind: z.literal("returned"), ...eventFields })
const retired = z.strictObject({
  kind: z.literal("retired"),
  employeeCode: code,
  retirementOn: date,
})

const nonCorrectionSchemas = [
  hire,
  rehire,
  primaryAssignmentStarted,
  transferred,
  concurrentAssignmentStarted,
  assignmentEnded,
  positionChanged,
  managerChanged,
  departmentResponsibilityStarted,
  departmentResponsibilityEnded,
  leaveStarted,
  returned,
  retired,
] as const

const nonCorrectionWireSchema = z.discriminatedUnion("kind", nonCorrectionSchemas)
export const wirePersonnelActionInputSchema = z.discriminatedUnion("kind", [
  ...nonCorrectionSchemas,
  z.strictObject({
    kind: z.literal("corrected"),
    eventOn: date,
    correctsActionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2_000),
    replacementAction: nonCorrectionWireSchema,
  }),
])

type NonCorrectionWireInput = z.infer<typeof nonCorrectionWireSchema>
export type WirePersonnelActionInput = z.infer<typeof wirePersonnelActionInputSchema>

async function resolvePosition(
  repository: D1CompanyResourceRepository,
  reference: { code: string | null | undefined; effectiveOn: string; organizationRevision: number },
): Promise<
  { title: string; reference: PersonnelPositionReference } | null | CompanyOperationError
> {
  if (reference.code === null || reference.code === undefined) return null
  const snapshot = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    organizationRevision: reference.organizationRevision,
    effectiveOn: restoreCalendarDate(reference.effectiveOn),
    types: ["position"],
    codes: [reference.code],
  })
  if (!snapshot.ok) {
    if (snapshot.cause instanceof CompanySnapshotRevisionError)
      return new CompanyValidationError("確認した会社版が見つかりません", "invalid_change")
    return new CompanyUnexpectedError("役職履歴を取得できません", { cause: snapshot.cause })
  }
  if (snapshot.resources.length !== 1)
    return new CompanyValidationError(
      "指定した会社版と日付の役職コードを一意に解決できません",
      "invalid_change",
    )
  const resource = snapshot.resources[0]
  const name = resource?.readText("officialName")
  if (resource === undefined || name === null || name === undefined)
    return new CompanyValidationError("役職名が不正です", "invalid_change")
  return {
    title: name,
    reference: {
      organizationId: resource.organizationId,
      organizationRevision: snapshot.organizationRevision,
      resourceId: resource.id,
      resourceRevision: resource.revision,
      code: reference.code,
      effectiveOn: reference.effectiveOn,
    },
  }
}

async function resolveNonCorrection(
  repository: D1CompanyResourceRepository,
  action: NonCorrectionWireInput,
  organizationRevision: number,
): Promise<unknown> {
  if (
    action.kind === "hire" ||
    action.kind === "rehire" ||
    action.kind === "primary_assignment_started" ||
    action.kind === "transferred" ||
    action.kind === "concurrent_assignment_started"
  ) {
    if (action.departmentCode == null && action.positionCode != null) {
      return new CompanyValidationError(
        "役職は配属先組織とあわせて指定してください",
        "invalid_change",
      )
    }
    const position = await resolvePosition(repository, {
      code: action.positionCode,
      effectiveOn: action.eventOn,
      organizationRevision,
    })
    if (position instanceof CompanyOperationError) return position
    const { positionCode: _positionCode, ...rest } = action
    return {
      ...rest,
      positionTitle: position?.title ?? null,
      ...(position === null ? {} : { positionReference: position.reference }),
    }
  }
  if (action.kind === "position_changed") {
    const position = await resolvePosition(repository, {
      code: action.positionCode,
      effectiveOn: action.eventOn,
      organizationRevision,
    })
    if (position instanceof CompanyOperationError) return position
    if (position === null) {
      return new CompanyValidationError("役職コードが必要です", "invalid_change")
    }
    const { positionCode: _positionCode, ...rest } = action
    return {
      ...rest,
      positionTitle: position?.title ?? null,
      ...(position === null ? {} : { positionReference: position.reference }),
    }
  }
  return action
}

/** HTTPの役職codeをCompanyの正規な役職名へ解決し、発令入力を確定する。 */
export async function resolvePersonnelActionInput(
  context: CompanyContext,
  wire: WirePersonnelActionInput,
  organizationRevision: number,
): Promise<PersonnelActionInput | CompanyOperationError> {
  const repository = new D1CompanyResourceRepository({ database: context.env.DB })
  if (wire.kind === "corrected") {
    const replacement = await resolveNonCorrection(
      repository,
      wire.replacementAction,
      organizationRevision,
    )
    if (replacement instanceof CompanyOperationError) return replacement
    const parsedReplacement = nonCorrectionPersonnelActionInputSchema.safeParse(replacement)
    if (!parsedReplacement.success) {
      return new CompanyValidationError(
        "人事発令が不正です",
        "personnel_action_invalid_transition",
        { cause: parsedReplacement.error },
      )
    }
    const parsed = personnelActionInputSchema.safeParse({
      ...wire,
      replacementAction: parsedReplacement.data,
    })
    return parsed.success
      ? parsed.data
      : new CompanyValidationError("人事発令が不正です", "personnel_action_invalid_transition", {
          cause: parsed.error,
        })
  }
  const resolved = await resolveNonCorrection(repository, wire, organizationRevision)
  if (resolved instanceof CompanyOperationError) return resolved
  const parsed = personnelActionInputSchema.safeParse(resolved)
  return parsed.success
    ? parsed.data
    : new CompanyValidationError("人事発令が不正です", "personnel_action_invalid_transition", {
        cause: parsed.error,
      })
}
