import { prepareSystemNotificationRecipientAccess } from "@system/interface/operations/prepare-system-notification-recipient-access"
import { SystemNotificationUnavailableError } from "@system/interface/errors"
/** /system/notifications/unread-count */
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization authenticated - 自分のAccount Deliveryだけを集計する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const access = await prepareSystemNotificationRecipientAccess(context)
  const unreadCount = await access.repository.countUnreadForAccount(access.accountId)
  if (unreadCount instanceof Error) {
    throw new SystemNotificationUnavailableError()
  }

  await access.revalidate()

  return context.json({ unread_count: unreadCount }, 200)
})
