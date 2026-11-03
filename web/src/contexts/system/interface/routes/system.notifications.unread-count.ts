import {
  SystemInvalidSessionError,
  SystemNotificationUnavailableError,
} from "@system/interface/errors"
/** /system/notifications/unread-count */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { selectVisibleSystemNotificationDeliveryIds } from "@system/interface/operations/select-visible-system-notification-delivery-ids"

// @authorization authenticated - 自分のAccount Deliveryだけを集計する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) {
    throw new SystemInvalidSessionError()
  }
  const visibleDeliveryIds = await selectVisibleSystemNotificationDeliveryIds({
    database: context.env.DB,
    recipientAccountId: accountId.data,
    visibility: context.var.systemNotificationVisibility,
    read: false,
  })
  if (visibleDeliveryIds instanceof Error) throw new SystemNotificationUnavailableError()
  const unreadCount = await new SystemNotificationRepository({
    context: { env: { DB: context.env.DB } },
  }).countUnreadForAccount(accountId.data, visibleDeliveryIds)
  if (unreadCount instanceof Error) {
    throw new SystemNotificationUnavailableError()
  }

  return context.json({ unread_count: unreadCount }, 200)
})
