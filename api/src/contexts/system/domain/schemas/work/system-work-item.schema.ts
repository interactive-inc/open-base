import { z } from "zod"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const instant = z.iso.datetime().transform((value) => new Date(value).toISOString())
const reason = z.string().trim().min(1).max(1000)
const content = z
  .string()
  .trim()
  .min(1)
  .max(10000)
  .transform((value) => value.replaceAll("\r\n", "\n"))
const digest = z.string().regex(/^[0-9a-f]{64}$/)

const actor = z.strictObject({
  accountId: zAccountId,
  principalId: z.string().min(1).max(255),
  kind: z.enum(["human", "agent"]),
})

export const systemWorkActorSchema = actor.readonly()
export const systemWorkHumanSchema = actor.extend({ kind: z.literal("human") }).readonly()

export const systemWorkAuthenticationSchema = z
  .strictObject({
    tokenVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    credentialId: z.string().min(1).max(255).nullable(),
    stepUpGrantId: z.string().min(1).max(255).nullable(),
  })
  .readonly()

export const systemWorkEvidenceSchema = z
  .array(
    z
      .strictObject({
        attachmentId: z.string().min(1).max(64),
        sha256: digest,
      })
      .readonly(),
  )
  .max(20)
  .refine((items) => new Set(items.map((item) => item.attachmentId)).size === items.length)
  .transform((items) =>
    items.toSorted((left, right) =>
      left.attachmentId < right.attachmentId ? -1 : left.attachmentId > right.attachmentId ? 1 : 0,
    ),
  )
  .readonly()

export const systemWorkResultContentSchema = z.strictObject({
  summary: content,
  evidence: systemWorkEvidenceSchema,
})

export const systemWorkResultSchema = systemWorkResultContentSchema
  .extend({
    id: z.uuid(),
    digest,
    submittedAt: instant,
    submittedBy: systemWorkActorSchema,
  })
  .readonly()

export const systemWorkHandoverSchema = z
  .strictObject({
    id: z.uuid(),
    to: systemWorkHumanSchema,
    requestedBy: systemWorkHumanSchema,
    requestedAt: instant,
    reason,
  })
  .readonly()

const command = z.strictObject({
  id: z.uuid(),
  commandId: z.uuid(),
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  reason,
})

export const createSystemWorkItemSchema = command.extend({
  kind: z.literal("create"),
  expectedRevision: z.literal(0),
  title: z.string().trim().min(1).max(300),
  instructions: content,
  acceptanceCriteria: content,
  assigneeAccountId: zAccountId,
  dueAt: instant.nullable(),
  previousRevisionId: z.uuid().nullable(),
})

export const acceptSystemWorkItemSchema = command.extend({ kind: z.literal("accept") })
export const submitSystemWorkResultSchema = command.extend({
  kind: z.literal("submit"),
  result: systemWorkResultContentSchema,
})
export const approveSystemWorkResultSchema = command.extend({
  kind: z.literal("approve"),
  resultId: z.uuid(),
  resultDigest: digest,
})
export const returnSystemWorkResultSchema = approveSystemWorkResultSchema.extend({
  kind: z.literal("return"),
})
export const requestSystemWorkHandoverSchema = command.extend({
  kind: z.literal("request_handover"),
  toAccountId: zAccountId,
})
export const acceptSystemWorkHandoverSchema = command.extend({
  kind: z.literal("accept_handover"),
  handoverId: z.uuid(),
})
export const declineSystemWorkHandoverSchema = acceptSystemWorkHandoverSchema.extend({
  kind: z.literal("decline_handover"),
})
export const cancelSystemWorkItemSchema = command.extend({ kind: z.literal("cancel") })

export const systemWorkCommandSchema = z.discriminatedUnion("kind", [
  createSystemWorkItemSchema,
  acceptSystemWorkItemSchema,
  submitSystemWorkResultSchema,
  approveSystemWorkResultSchema,
  returnSystemWorkResultSchema,
  requestSystemWorkHandoverSchema,
  acceptSystemWorkHandoverSchema,
  declineSystemWorkHandoverSchema,
  cancelSystemWorkItemSchema,
])

export const systemWorkItemSchema = z
  .strictObject({
    id: z.uuid(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    commandId: z.uuid(),
    requestDigest: digest,
    action: z.enum([
      "create",
      "accept",
      "submit",
      "approve",
      "return",
      "request_handover",
      "accept_handover",
      "decline_handover",
      "cancel",
    ]),
    title: z.string().trim().min(1).max(300),
    instructions: content,
    acceptanceCriteria: content,
    dueAt: instant.nullable(),
    previousRevisionId: z.uuid().nullable(),
    createdBy: systemWorkHumanSchema,
    createdAt: instant,
    assignee: systemWorkActorSchema,
    accountable: systemWorkHumanSchema,
    state: z.enum(["offered", "active", "review_pending", "completed", "cancelled"]),
    result: systemWorkResultSchema.nullable(),
    handover: systemWorkHandoverSchema.nullable(),
    actor: systemWorkActorSchema,
    authentication: systemWorkAuthenticationSchema,
    recovery: z.boolean(),
    reason,
    recordedAt: instant,
    auditEventId: z.uuid(),
  })
  .readonly()

export type SystemWorkActor = z.output<typeof systemWorkActorSchema>
export type SystemWorkHuman = z.output<typeof systemWorkHumanSchema>
export type SystemWorkCommand = z.output<typeof systemWorkCommandSchema>
export type SystemWorkItem = z.output<typeof systemWorkItemSchema>
export type SystemWorkAuthentication = z.output<typeof systemWorkAuthenticationSchema>
