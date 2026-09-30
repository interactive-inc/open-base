import {
  SystemForbiddenError,
  SystemInvalidSessionError,
  SystemNotificationInvalidError,
  SystemNotificationRecipientNotFoundError,
  SystemNotificationUnavailableError,
} from "@system/interface/errors"
/** /system/notifications */
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { notificationSourceReferenceSchema } from "@system/domain/schemas/notifications/notification-reference.schema"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { SystemActiveAccountAdapter } from "@system/infrastructure/adapters/auth/system-active-account.adapter"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - 自分のAccount Deliveryだけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.object({
      read: z.enum(["true", "false"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemInvalidSessionError()
    }
    const query = context.req.valid("query")
    const page = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).findMany({
      recipientAccountId: accountId.data,
      read: query.read === undefined ? null : query.read === "true",
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }

    return context.json(
      {
        notifications: page.items.map(({ delivery, message }) => ({
          id: delivery.id,
          message_id: message.id,
          kind: message.kind,
          title: message.title,
          body: message.body,
          source:
            message.source === null ? null : { type: message.source.type, id: message.source.id },
          action: message.action,
          resource_scope: message.resourceScope,
          priority: message.priority,
          delivered_at: delivery.deliveredAt.toISOString(),
          read_at: delivery.readAt?.toISOString() ?? null,
        })),
        total: page.total,
        limit: query.limit,
        offset: query.offset,
      },
      200,
    )
  },
)

// @authorization permission notification:send - 任意のactive System Accountへ配信する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z.object({
      recipient_account_ids: z
        .array(z.string().min(1).max(255).brand<"AccountId">())
        .min(1)
        .max(100),
      kind: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(10_000).nullable().default(null),
      source: z
        .object({
          type: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u),
          id: z.string().min(1).max(512),
        })
        .strict()
        .nullable()
        .default(null),
      action: notificationSourceReferenceSchema.nullable().default(null),
      resource_scope: notificationSourceReferenceSchema.nullable().default(null),
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    }),
  ),
  async (context) => {
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has(SystemFeaturePermission.NOTIFICATION_SEND.key)
    ) {
      throw new SystemForbiddenError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemNotificationUnavailableError()
    }
    const body = context.req.valid("json")
    const recipientsAreActive = await new SystemActiveAccountAdapter({
      env: { DB: context.env.DB },
    }).containsAll(body.recipient_account_ids)
    if (recipientsAreActive instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }
    if (!recipientsAreActive) {
      throw new SystemNotificationRecipientNotFoundError()
    }
    const message = NotificationMessageEntity.create({
      id: crypto.randomUUID(),
      kind: body.kind,
      title: body.title,
      body: body.body,
      source: body.source,
      action: body.action,
      resourceScope: body.resource_scope,
      priority: body.priority,
      createdAt: now,
    })
    if (message instanceof Error) {
      throw new SystemNotificationInvalidError()
    }
    const deliveries = body.recipient_account_ids.map((recipientAccountId) =>
      NotificationDeliveryEntity.create({
        id: crypto.randomUUID(),
        messageId: message.id,
        recipientAccountId,
        deliveredAt: now,
        readAt: null,
        dismissedAt: null,
      }),
    )
    const invalidDelivery = deliveries.find((delivery) => delivery instanceof Error)
    if (invalidDelivery instanceof Error) {
      throw new SystemNotificationInvalidError()
    }
    const deliveryBatch = NotificationDeliveryBatchValue.create(deliveries)
    if (deliveryBatch instanceof Error) {
      throw new SystemNotificationInvalidError()
    }

    const publication = await new PublishSystemNotification({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: context.env.DB } },
      }),
    }).execute({ message, deliveries: deliveryBatch })
    if (publication instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }
    if (publication.kind === "rejected") {
      throw new SystemNotificationInvalidError()
    }

    return context.json(
      {
        message_id: message.id,
        delivery_ids: deliveryBatch.deliveries.map((delivery) => delivery.id),
      },
      201,
    )
  },
)

// @authorization authenticated - 自分の未読Deliveryを一括で既読にする
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", z.object({ read: z.literal(true) })),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemInvalidSessionError()
    }
    const readAt = context.var.now()
    if (!Number.isSafeInteger(readAt.getTime())) {
      throw new SystemNotificationUnavailableError()
    }
    const markedCount = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).markAllDeliveriesRead(accountId.data, readAt)
    if (markedCount instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }

    return context.json({ marked_count: markedCount }, 200)
  },
)
