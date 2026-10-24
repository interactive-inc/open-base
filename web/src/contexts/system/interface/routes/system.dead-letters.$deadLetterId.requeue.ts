import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { authorizeSystemOperation } from "@system/interface/authorization/authorize-system-operation"
import {
  SystemDeliveryConflictError,
  SystemDeliveryInvalidError,
  SystemDeliveryNotFoundError,
  SystemDeliveryUnavailableError,
  SystemForbiddenError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { systemDeadLetterResponse } from "@system/interface/responses/system-dead-letter-response"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const requestBody = z
  .object({
    max_attempts: z.number().int().min(1).max(100),
    available_at: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1).max(200),
  })
  .strict()

// @authorization permission batch:write system:admin - step-up後にdead letterを一度だけjobへ再投入する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.object({ deadLetterId: z.string().regex(/^\S{1,255}$/) }).strict()),
  zValidator("json", requestBody),
  async (context) => {
    const now = context.var.now()
    if (
      !authorizeSystemOperation(context.var.permissions, "batch:write", now) ||
      !authorizeSystemOperation(context.var.permissions, "system:admin", now)
    ) {
      throw new SystemForbiddenError()
    }
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) throw new SystemDeliveryUnavailableError(accountId.error)
    const systemContext = { env: { DB: context.env.DB } }
    const repository = new SystemDeliveryRepository(systemContext)
    const deadLetterId = context.req.valid("param").deadLetterId
    const deadLetter = await repository.findDeadLetter(deadLetterId)
    if (deadLetter instanceof Error) throw new SystemDeliveryUnavailableError(deadLetter)
    if (deadLetter === null) throw new SystemDeliveryNotFoundError()
    if (deadLetter.sourceType !== "inbox") {
      const source = await repository.find(deadLetter.sourceType, deadLetter.sourceId)
      if (source instanceof Error) throw new SystemDeliveryUnavailableError(source)
      if (source === null) throw new SystemDeliveryNotFoundError()
      if (source.handlerKey !== null) throw new SystemForbiddenError()
    }
    if (deadLetter.requeuedJobId !== null) {
      return context.json({ job_id: deadLetter.requeuedJobId, replayed: true }, 200)
    }
    const body = context.req.valid("json")
    const job = SystemDeliveryEntity.create({
      id: crypto.randomUUID(),
      kind: "job",
      operationKey: `system.dead_letter.reprocess.${deadLetter.sourceType}`,
      payloadDigest: deadLetter.payloadDigest,
      idempotencyKey: `dead-letter:${deadLetter.id}`,
      status: "queued",
      attempt: 0,
      maxAttempts: body.max_attempts,
      availableAt: new Date(body.available_at),
      leaseAccountId: null,
      leaseTokenHash: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    })
    if (job instanceof Error) throw new SystemDeliveryInvalidError(job)
    const before = StableSystemAuditJsonValue.create(systemDeadLetterResponse(deadLetter))
    const after = StableSystemAuditJsonValue.create({
      ...systemDeadLetterResponse(deadLetter),
      requeued_job_id: job.id,
      requeued_at: now.toISOString(),
    })
    if (before === null || after === null || before instanceof Error || after instanceof Error) {
      throw new SystemDeliveryUnavailableError(
        before === null || before instanceof Error ? before : after,
      )
    }
    const event = SystemAuditEventEntity.create({
      actorAccountId: accountId.data,
      action: SYSTEM_AUDIT_ACTIONS.systemDeadLetterRequeued,
      targetType: "system:dead_letter",
      targetId: deadLetter.id,
      outcome: "succeeded",
      reasonCode: body.reason,
      authorizationJson: null,
      beforeJson: before.toString(),
      afterJson: after.toString(),
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) throw new SystemDeliveryUnavailableError(event)
    const result = await repository.requeueDeadLetter(
      deadLetter.id,
      job,
      accountId.data,
      new SystemAuditEventRepository(systemContext).prepareAppend(event),
    )
    if (result instanceof Error) throw new SystemDeliveryUnavailableError(result)
    if (result === "not_found") throw new SystemDeliveryNotFoundError()
    if (result === "conflict") throw new SystemDeliveryConflictError()
    return context.json(
      { job_id: result.jobId, replayed: result.status === "replayed" },
      result.status === "replayed" ? 200 : 201,
    )
  },
)
