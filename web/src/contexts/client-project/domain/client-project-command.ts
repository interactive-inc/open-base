import { z } from "zod"

const id = z.uuid()
const name = z.string().trim().min(1).max(200)
const minutes = z.number().int().min(0).max(60000000)
export const recordKinds = ["project", "effort"] as const
const common = {
  id,
  expected_revision: z.number().int().min(0).max(2147483646),
  reason: z.string().trim().min(1).max(3000),
}
export const clientProjectCommandSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      ...common,
      kind: z.literal("project"),
      name,
      customer_id: id,
      offering_id: id.nullable().default(null),
      owner_employee_id: id,
      description: z.string().trim().max(3000),
      status: z.enum(["planned", "active", "completed", "cancelled"]),
      starts_on: z.iso.date().nullable(),
      due_on: z.iso.date().nullable(),
      planned_minutes: minutes.nullable(),
      remaining_minutes: minutes.nullable(),
    })
    .refine(
      (item) => item.starts_on === null || item.due_on === null || item.starts_on <= item.due_on,
    ),
  z.strictObject({
    ...common,
    kind: z.literal("effort"),
    project_id: id,
    worked_on: z.iso.date(),
    minutes: z.number().int().min(1).max(1440),
    status: z.enum(["recorded", "void"]),
  }),
])
export type ClientProjectCommand = z.infer<typeof clientProjectCommandSchema>
