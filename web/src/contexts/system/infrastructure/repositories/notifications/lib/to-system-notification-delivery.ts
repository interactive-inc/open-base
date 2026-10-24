import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"

/** untrustedなD1 rowをcanonical Notification Deliveryへfail closedに変換する。 */
export function toSystemNotificationDelivery(row: unknown): NotificationDeliveryEntity | Error {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return new Error("System Notification Delivery row is invalid")
  }
  const record = row as Record<string, unknown>

  return NotificationDeliveryEntity.create({
    id: record.id,
    messageId: record.message_id,
    recipientAccountId: record.recipient_account_id,
    deliveredAt:
      typeof record.delivered_at === "number" ? new Date(record.delivered_at) : record.delivered_at,
    readAt:
      record.read_at === null
        ? null
        : typeof record.read_at === "number"
          ? new Date(record.read_at)
          : record.read_at,
    dismissedAt:
      record.dismissed_at == null
        ? null
        : typeof record.dismissed_at === "number"
          ? new Date(record.dismissed_at)
          : record.dismissed_at,
  })
}
