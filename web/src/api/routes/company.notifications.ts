import { PublishEmployeeNotification } from "@/api/http/notifications/publish-employee-notification"
import { companyNotificationKindSchema } from "@/api/http/notifications/notification-kind.definition"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppNotification } from "@/api/http/company/response-schemas"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/validation/code.schema"

// @authorization service - session を application service に渡して判定する
/** POST /notifications — 権限を持つ役割が通知を作成する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      recipient_employee_code: codeSchema,
      kind: companyNotificationKindSchema.default("announcement"),
      title: z.string().min(1).max(200),
      body: z.string().max(5_000).optional(),
      source_domain: z.string().max(100).optional(),
      source_id: z.number().int().positive().safe().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const result = await new PublishEmployeeNotification(c).run({
      session: session,
      recipientEmployeeCode: body.recipient_employee_code,
      kind: body.kind,
      title: body.title,
      body: body.body ?? null,
      sourceDomain: body.source_domain ?? "manual",
      sourceId: body.source_id ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppNotification.parse({
      id: result.notification.id,
      recipient_employee_id: result.recipientEmployeeId,
      source_domain: result.notification.sourceDomain,
      source_id: result.notification.sourceId,
      kind: result.notification.kind,
      title: result.notification.title,
      body: result.notification.body,
      is_read: result.notification.isRead,
      created_at: result.notification.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
