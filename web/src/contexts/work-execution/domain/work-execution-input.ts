import { z } from "zod"

export const workSlug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const label = z.string().trim().min(1).max(100)
export const definitionInput = z
  .strictObject({
    slug: workSlug,
    expected_revision: z.number().int().min(0).max(2147483646),
    name: label,
    description: z.string().trim().max(500),
    tags: z.array(label).max(20).default([]),
    agent_id: z.uuid(),
    owner_employee_id: z.uuid(),
    external_app_id: label.nullable().default(null),
    document_reference: z.string().trim().min(1).max(500).nullable().default(null),
    status: z.enum(["active", "retired"]),
    reason: z.string().trim().min(1).max(500),
  })
  .refine((value) => value.expected_revision !== 0 || value.status === "active")

const reference = z.strictObject({ kind: workSlug, id: label })
export const executionInput = z
  .strictObject({
    id: z.uuid(),
    slug: workSlug,
    definition_revision: z.number().int().positive(),
    started_at: z.iso.datetime({ precision: 3 }),
    finished_at: z.iso.datetime({ precision: 3 }),
    outcome: z.enum(["succeeded", "failed", "needs_review"]),
    summary: z.string().trim().max(1000),
    references: z.array(reference).max(20).default([]),
    corrects_id: z.uuid().nullable().default(null),
  })
  .refine((value) => value.started_at <= value.finished_at && value.corrects_id !== value.id)

const page = {
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}
export const definitionQuery = z
  .strictObject({
    ...page,
    slug: workSlug.optional(),
    tag: label.optional(),
    revision: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => value.revision === undefined || value.slug !== undefined)
export const executionQuery = z
  .strictObject({
    ...page,
    slug: workSlug.optional(),
    agent_id: z.uuid().optional(),
    tag: label.optional(),
    reference_kind: workSlug.optional(),
    reference_id: label.optional(),
    since: z.iso.datetime({ precision: 3 }).optional(),
  })
  .refine((value) => (value.reference_kind === undefined) === (value.reference_id === undefined))
