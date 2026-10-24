import { personnelPositionReferenceSchema } from "@/contexts/company/domain/definitions/personnel-position-reference.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"

/** Company内の雇用期間に対して有効日で評価する在籍状態。 */
export const lifecycleEmployeeStatusSchema = z.enum(["prehire", "active", "leave", "retired"])

export type LifecycleEmployeeStatus = z.infer<typeof lifecycleEmployeeStatusSchema>

export const personnelActionKindSchema = z.enum([
  "hire",
  "rehire",
  "primary_assignment_started",
  "transferred",
  "concurrent_assignment_started",
  "assignment_ended",
  "position_changed",
  "manager_changed",
  "department_responsibility_started",
  "department_responsibility_ended",
  "leave_started",
  "returned",
  "retired",
  "corrected",
  "initial_state",
  "employment_revised",
])

export type PersonnelActionKind = z.infer<typeof personnelActionKindSchema>

export const LIFECYCLE_ERROR_CODES = [
  "lifecycle_action_required",
  "invalid_lifecycle_cursor",
  "personnel_action_stale",
  "employment_period_conflict",
  "status_period_conflict",
  "primary_assignment_conflict",
  "assignment_period_conflict",
  "manager_cycle",
  "manager_not_active",
  "department_not_active",
  "personnel_action_invalid_transition",
  "personnel_action_already_corrected",
  "idempotency_conflict",
  "company_timezone_unavailable",
  "employee_archive_required",
  "employee_not_retired",
  "lifecycle_projection_mismatch",
] as const

export const lifecycleErrorCodeSchema = z.enum(LIFECYCLE_ERROR_CODES)

export type LifecycleErrorCode = z.infer<typeof lifecycleErrorCodeSchema>

const hireActionSchema = z
  .object({
    kind: z.literal("hire"),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
    employeeCode: z.string().min(1).max(200),
    employeeName: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200).nullable().optional(),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable().optional(),
    managerEmployeeCode: z.string().min(1).max(200).nullable().optional(),
  })
  .strict()

const rehireActionSchema = z
  .object({
    kind: z.literal("rehire"),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200).nullable().optional(),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable().optional(),
    managerEmployeeCode: z.string().min(1).max(200).nullable().optional(),
  })
  .strict()

const primaryAssignmentStartedActionSchema = z
  .object({
    kind: z.literal("primary_assignment_started"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: z.string().min(1).max(200).nullable(),
  })
  .strict()

const transferredActionSchema = z
  .object({
    kind: z.literal("transferred"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: z.string().min(1).max(200).nullable(),
  })
  .strict()

const concurrentAssignmentStartedActionSchema = z
  .object({
    kind: z.literal("concurrent_assignment_started"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: z.string().min(1).max(200).nullable(),
  })
  .strict()

const assignmentEndedActionSchema = z
  .object({
    kind: z.literal("assignment_ended"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    assignmentType: z.enum(["primary", "concurrent"]),
  })
  .strict()

const positionChangedActionSchema = z
  .object({
    kind: z.literal("position_changed"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    assignmentType: z.enum(["primary", "concurrent"]),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200),
    changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
  })
  .strict()

const managerChangedActionSchema = z
  .object({
    kind: z.literal("manager_changed"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
    assignmentType: z.enum(["primary", "concurrent"]),
    managerEmployeeCode: z.string().min(1).max(200).nullable(),
  })
  .strict()

const departmentResponsibilityStartedActionSchema = z
  .object({
    kind: z.literal("department_responsibility_started"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
  })
  .strict()

const departmentResponsibilityEndedActionSchema = z
  .object({
    kind: z.literal("department_responsibility_ended"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    departmentCode: z.string().min(1).max(200),
  })
  .strict()

const leaveStartedActionSchema = z
  .object({
    kind: z.literal("leave_started"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
  })
  .strict()

const returnedActionSchema = z
  .object({
    kind: z.literal("returned"),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
  })
  .strict()

const retiredActionSchema = z
  .object({
    kind: z.literal("retired"),
    employeeCode: z.string().min(1).max(200),
    retirementOn: z.string().refine(isCalendarDate),
  })
  .strict()

const nonCorrectionActionSchemas = [
  hireActionSchema,
  rehireActionSchema,
  primaryAssignmentStartedActionSchema,
  transferredActionSchema,
  concurrentAssignmentStartedActionSchema,
  assignmentEndedActionSchema,
  positionChangedActionSchema,
  managerChangedActionSchema,
  departmentResponsibilityStartedActionSchema,
  departmentResponsibilityEndedActionSchema,
  leaveStartedActionSchema,
  returnedActionSchema,
  retiredActionSchema,
] as const

export const nonCorrectionPersonnelActionInputSchema = z.discriminatedUnion(
  "kind",
  nonCorrectionActionSchemas,
)

const correctedActionSchema = z
  .object({
    kind: z.literal("corrected"),
    eventOn: z.string().refine(isCalendarDate),
    correctsActionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2000),
    replacementAction: nonCorrectionPersonnelActionInputSchema,
  })
  .strict()

const initialStateActionSchema = z
  .object({
    kind: z.literal("initial_state"),
    employmentType: z.enum(["FULL_TIME", "PART_TIME"]).nullable(),
    employeeCode: z.string().min(1).max(200),
    eventOn: z.string().refine(isCalendarDate),
    initialStatus: z.enum(["active", "leave", "retired"]),
    departmentCode: z.string().min(1).max(200).nullable(),
    positionReference: personnelPositionReferenceSchema.optional(),
    positionTitle: z.string().min(1).max(200).nullable(),
    managerEmployeeCode: z.string().min(1).max(200).nullable(),
  })
  .strict()

export const personnelActionInputSchema = z.discriminatedUnion("kind", [
  ...nonCorrectionActionSchemas,
  correctedActionSchema,
  initialStateActionSchema,
])

export type PersonnelActionInput = z.infer<typeof personnelActionInputSchema>
