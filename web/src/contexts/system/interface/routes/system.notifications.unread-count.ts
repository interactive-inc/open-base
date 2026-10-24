import {
  SystemInvalidSessionError,
  SystemNotificationUnavailableError,
} from "@system/interface/errors"
/** /system/notifications/unread-count */
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization authenticated - 自分のAccount Deliveryだけを集計する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) {
    throw new SystemInvalidSessionError()
  }
  const unreadCount = await new SystemNotificationRepository({
    context: { env: { DB: context.env.DB } },
  }).countUnreadForAccount(accountId.data)
  if (unreadCount instanceof Error) {
    throw new SystemNotificationUnavailableError()
  }

  return context.json({ unread_count: unreadCount }, 200)
})
