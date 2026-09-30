import {
  SystemInvalidSessionError,
  SystemNotificationNotFoundError,
  SystemNotificationTransitionInvalidError,
  SystemNotificationUnavailableError,
} from "@system/interface/errors"
/** /system/notifications/:id */
import { DismissSystemNotification } from "@system/application/notifications/dismiss-system-notification"
import { MarkSystemNotificationRead } from "@system/application/notifications/mark-system-notification-read"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 自分のAccount Deliveryだけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemInvalidSessionError()
    }
    const notification = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).findByDeliveryIdForAccount(context.req.valid("param").id, accountId.data)
    if (notification instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }
    if (notification === null) {
      throw new SystemNotificationNotFoundError()
    }

    return context.json(
      {
        id: notification.delivery.id,
        message_id: notification.message.id,
        kind: notification.message.kind,
        title: notification.message.title,
        body: notification.message.body,
        source:
          notification.message.source === null
            ? null
            : {
                type: notification.message.source.type,
                id: notification.message.source.id,
              },
        action: notification.message.action,
        resource_scope: notification.message.resourceScope,
        priority: notification.message.priority,
        delivered_at: notification.delivery.deliveredAt.toISOString(),
        read_at: notification.delivery.readAt?.toISOString() ?? null,
      },
      200,
    )
  },
)

// @authorization owner - 自分のAccount Deliveryだけを単調に既読化する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
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
    const transition = await new MarkSystemNotificationRead({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: context.env.DB } },
      }),
    }).execute({
      deliveryId: context.req.valid("param").id,
      recipientAccountId: accountId.data,
      readAt,
    })
    if (transition instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }
    if (transition.kind === "not_found") {
      throw new SystemNotificationNotFoundError()
    }
    if (transition.kind === "rejected") {
      throw new SystemNotificationTransitionInvalidError()
    }

    return context.json(
      {
        id: transition.delivery.id,
        read_at: transition.delivery.readAt?.toISOString() ?? null,
      },
      200,
    )
  },
)

// @authorization owner - 自分のAccount Deliveryだけを非表示にする
export const DELETE = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemInvalidSessionError()
    }
    const dismissedAt = context.var.now()
    if (!Number.isSafeInteger(dismissedAt.getTime())) {
      throw new SystemNotificationUnavailableError()
    }
    const transition = await new DismissSystemNotification({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: context.env.DB } },
      }),
    }).execute({
      deliveryId: context.req.valid("param").id,
      recipientAccountId: accountId.data,
      dismissedAt,
    })
    if (transition instanceof Error) {
      throw new SystemNotificationUnavailableError()
    }
    if (transition.kind === "not_found") {
      throw new SystemNotificationNotFoundError()
    }
    if (transition.kind === "rejected") {
      throw new SystemNotificationTransitionInvalidError()
    }

    return context.body(null, 204)
  },
)
