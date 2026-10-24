import { personnelActionKindSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { z } from "zod"

const departmentSnapshotSchema = z
  .object({
    code: z.string(),
    name: z.string(),
  })
  .strict()

const assignmentSummaryFields = {
  eventOn: z.string(),
  department: departmentSnapshotSchema,
  assignmentType: z.enum(["primary", "concurrent"]),
}

export const personnelActionSummarySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["hire", "rehire"]),
      employmentType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
      eventOn: z.string(),
      department: departmentSnapshotSchema.nullable(),
      positionTitle: z.string().nullable(),
      managerEmployeeCode: z.string().nullable(),
      status: z.literal("active"),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["primary_assignment_started", "transferred", "concurrent_assignment_started"]),
      ...assignmentSummaryFields,
      positionTitle: z.string().nullable(),
      managerEmployeeCode: z.string().nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("assignment_ended"), ...assignmentSummaryFields }).strict(),
  z
    .object({
      kind: z.literal("position_changed"),
      ...assignmentSummaryFields,
      previousPositionTitle: z.string().nullable(),
      positionTitle: z.string(),
      changeType: z.enum(["promotion", "demotion", "lateral", "other"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("manager_changed"),
      ...assignmentSummaryFields,
      previousManagerEmployeeCode: z.string().nullable(),
      managerEmployeeCode: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["department_responsibility_started", "department_responsibility_ended"]),
      eventOn: z.string(),
      department: departmentSnapshotSchema,
    })
    .strict(),
  z
    .object({
      kind: z.enum(["leave_started", "returned"]),
      eventOn: z.string(),
      status: z.enum(["active", "leave"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("retired"),
      eventOn: z.string(),
      status: z.literal("retired"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("corrected"),
      eventOn: z.string(),
      correctsActionId: z.string(),
      replacementKind: personnelActionKindSchema.exclude([
        "corrected",
        "initial_state",
        "employment_revised",
      ]),
      replacementEventOn: z.string().date().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("initial_state"),
      eventOn: z.string(),
      employmentType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
      department: departmentSnapshotSchema.nullable(),
      positionTitle: z.string().nullable(),
      managerEmployeeCode: z.string().nullable(),
      status: z.enum(["active", "leave", "retired"]),
      employeeId: z.string().optional(),
      employmentId: z.string().optional(),
      actorAccountId: z.string().nullable().optional(),
      reason: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("employment_revised"),
      eventOn: z.string(),
      employeeId: z.string(),
      status: z.enum(["active", "leave", "retired"]),
      resourceId: z.string(),
      resourceRevision: z.number().int().positive(),
      resource: z.record(z.string(), z.json()),
      reason: z.string(),
    })
    .strict(),
])

export type PersonnelActionSummary = z.infer<typeof personnelActionSummarySchema>
