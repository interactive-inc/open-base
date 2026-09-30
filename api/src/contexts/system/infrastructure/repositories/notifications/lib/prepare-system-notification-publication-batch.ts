import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"

export type SystemNotificationPublication = Readonly<{
  message: NotificationMessageEntity
  deliveries: NotificationDeliveryBatchValue
}>

const maximumPayloadBytes = 1_000_000

type MessagePayload = Readonly<{
  id: string
  kind: string
  title: string
  body: string | null
  sourceType: string | null
  sourceId: string | null
  actionType: string | null
  actionId: string | null
  resourceType: string | null
  resourceId: string | null
  priority: string
  publicationKey: string | null
  createdAt: number
}>

type DeliveryPayload = Readonly<{
  id: string
  messageId: string
  recipientAccountId: string
  deliveredAt: number
}>

function toPayload(
  publications: ReadonlyArray<SystemNotificationPublication>,
): Readonly<{ messages: string; deliveries: string }> | Error {
  if (!Array.isArray(publications) || publications.length === 0) {
    return new Error("System Notification publication batch is empty")
  }
  const messageIds = new Set<string>()
  const publicationKeys = new Set<string>()
  const deliveryIds = new Set<string>()
  const messages: MessagePayload[] = []
  const deliveries: DeliveryPayload[] = []

  for (const publication of publications) {
    if (
      typeof publication !== "object" ||
      publication === null ||
      !(publication.message instanceof NotificationMessageEntity) ||
      !(publication.deliveries instanceof NotificationDeliveryBatchValue)
    ) {
      return new Error("System Notification publication batch has invalid entities")
    }
    const message = publication.message
    if (messageIds.has(message.id) || publication.deliveries.deliveries.length === 0) {
      return new Error("System Notification publication batch has duplicate or empty messages")
    }
    messageIds.add(message.id)
    if (message.publicationKey !== null) {
      if (publicationKeys.has(message.publicationKey)) {
        return new Error("System Notification publication batch has duplicate keys")
      }
      publicationKeys.add(message.publicationKey)
    }
    messages.push({
      id: message.id,
      kind: message.kind,
      title: message.title,
      body: message.body,
      sourceType: message.source?.type ?? null,
      sourceId: message.source?.id ?? null,
      actionType: message.action?.type ?? null,
      actionId: message.action?.id ?? null,
      resourceType: message.resourceScope?.type ?? null,
      resourceId: message.resourceScope?.id ?? null,
      priority: message.priority,
      publicationKey: message.publicationKey,
      createdAt: message.createdAt.getTime(),
    })
    const recipients = new Set<string>()
    for (const delivery of publication.deliveries.deliveries) {
      if (
        delivery.messageId !== message.id ||
        delivery.isRead ||
        delivery.deliveredAt.getTime() < message.createdAt.getTime() ||
        deliveryIds.has(delivery.id) ||
        recipients.has(delivery.recipientAccountId)
      ) {
        return new Error("System Notification publication batch has invalid deliveries")
      }
      deliveryIds.add(delivery.id)
      recipients.add(delivery.recipientAccountId)
      deliveries.push({
        id: delivery.id,
        messageId: delivery.messageId,
        recipientAccountId: delivery.recipientAccountId,
        deliveredAt: delivery.deliveredAt.getTime(),
      })
    }
  }

  const messagePayload = JSON.stringify(messages)
  const deliveryPayload = JSON.stringify(deliveries)
  const encoder = new TextEncoder()
  if (
    encoder.encode(messagePayload).byteLength + encoder.encode(deliveryPayload).byteLength >
    maximumPayloadBytes
  ) {
    return new Error("System Notification publication batch payload is too large")
  }
  return { messages: messagePayload, deliveries: deliveryPayload }
}

/** Message、scope、Deliveryを4 SQL statementで作り、同一batchの業務変更も全rollback可能にする。 */
export function prepareSystemNotificationPublicationBatch(
  database: D1Database,
  publications: ReadonlyArray<SystemNotificationPublication>,
): ReadonlyArray<D1PreparedStatement> | Error {
  const payload = toPayload(publications)
  if (payload instanceof Error) return payload
  return [
    database
      .prepare(
        `INSERT INTO system_notification_messages
           (id, kind, title, body, source_type, source_id, priority,
            action_type, action_id, dedupe_key, created_at)
         SELECT
           json_extract(item.value, '$.id'),
           json_extract(item.value, '$.kind'),
           json_extract(item.value, '$.title'),
           json_extract(item.value, '$.body'),
           json_extract(item.value, '$.sourceType'),
           json_extract(item.value, '$.sourceId'),
           json_extract(item.value, '$.priority'),
           json_extract(item.value, '$.actionType'),
           json_extract(item.value, '$.actionId'),
           json_extract(item.value, '$.publicationKey'),
           json_extract(item.value, '$.createdAt')
         FROM json_each(?1) AS item
         WHERE 1
         ON CONFLICT(dedupe_key) DO NOTHING`,
      )
      .bind(payload.messages),
    database
      .prepare(
        `INSERT INTO system_notification_resource_scopes
           (message_id, resource_type, resource_id)
         SELECT
           message.id,
           json_extract(item.value, '$.resourceType'),
           json_extract(item.value, '$.resourceId')
         FROM json_each(?1) AS item
         INNER JOIN system_notification_messages AS message
           ON (
             json_extract(item.value, '$.publicationKey') IS NOT NULL
             AND message.dedupe_key = json_extract(item.value, '$.publicationKey')
           ) OR (
             json_extract(item.value, '$.publicationKey') IS NULL
             AND message.id = json_extract(item.value, '$.id')
           )
         WHERE json_extract(item.value, '$.resourceType') IS NOT NULL
         ON CONFLICT(message_id) DO NOTHING`,
      )
      .bind(payload.messages),
    database
      .prepare(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at, read_at)
         SELECT
           json_extract(delivery.value, '$.id'),
           message.id,
           account.id,
           json_extract(delivery.value, '$.deliveredAt'),
           NULL
         FROM json_each(?1) AS delivery
         INNER JOIN json_each(?2) AS requested
           ON json_extract(requested.value, '$.id') = json_extract(delivery.value, '$.messageId')
         INNER JOIN system_notification_messages AS message
           ON (
             json_extract(requested.value, '$.publicationKey') IS NOT NULL
             AND message.dedupe_key = json_extract(requested.value, '$.publicationKey')
           ) OR (
             json_extract(requested.value, '$.publicationKey') IS NULL
             AND message.id = json_extract(requested.value, '$.id')
           )
         INNER JOIN system_accounts AS account
           ON account.id = json_extract(delivery.value, '$.recipientAccountId')
          AND account.status = 'active'
         WHERE 1
         ON CONFLICT(message_id, recipient_account_id) DO NOTHING`,
      )
      .bind(payload.deliveries, payload.messages),
    database
      .prepare(
        `SELECT CASE WHEN
           json_array_length(?1) > 0
           AND NOT EXISTS (
             SELECT 1 FROM json_each(?1) AS requested
             LEFT JOIN system_notification_messages AS message
               ON (
                 json_extract(requested.value, '$.publicationKey') IS NOT NULL
                 AND message.dedupe_key = json_extract(requested.value, '$.publicationKey')
               ) OR (
                 json_extract(requested.value, '$.publicationKey') IS NULL
                 AND message.id = json_extract(requested.value, '$.id')
               )
             LEFT JOIN system_notification_resource_scopes AS scope
               ON scope.message_id = message.id
             WHERE message.id IS NULL
                OR message.kind IS NOT json_extract(requested.value, '$.kind')
                OR message.title IS NOT json_extract(requested.value, '$.title')
                OR message.body IS NOT json_extract(requested.value, '$.body')
                OR message.source_type IS NOT json_extract(requested.value, '$.sourceType')
                OR message.source_id IS NOT json_extract(requested.value, '$.sourceId')
                OR message.priority IS NOT json_extract(requested.value, '$.priority')
                OR message.action_type IS NOT json_extract(requested.value, '$.actionType')
                OR message.action_id IS NOT json_extract(requested.value, '$.actionId')
                OR scope.resource_type IS NOT json_extract(requested.value, '$.resourceType')
                OR scope.resource_id IS NOT json_extract(requested.value, '$.resourceId')
                OR (
                  json_extract(requested.value, '$.publicationKey') IS NULL
                  AND message.created_at IS NOT json_extract(requested.value, '$.createdAt')
                )
           )
           AND NOT EXISTS (
             SELECT 1 FROM json_each(?2) AS delivery
             LEFT JOIN json_each(?1) AS requested
               ON json_extract(requested.value, '$.id') = json_extract(delivery.value, '$.messageId')
             LEFT JOIN system_notification_messages AS message
               ON (
                 json_extract(requested.value, '$.publicationKey') IS NOT NULL
                 AND message.dedupe_key = json_extract(requested.value, '$.publicationKey')
               ) OR (
                 json_extract(requested.value, '$.publicationKey') IS NULL
                 AND message.id = json_extract(requested.value, '$.id')
               )
             LEFT JOIN system_notification_deliveries AS existing
               ON existing.message_id = message.id
              AND existing.recipient_account_id = json_extract(delivery.value, '$.recipientAccountId')
             WHERE requested.value IS NULL OR existing.id IS NULL
           )
           AND NOT EXISTS (
             SELECT 1 FROM json_each(?1) AS requested
             INNER JOIN system_notification_messages AS message
               ON (
                 json_extract(requested.value, '$.publicationKey') IS NOT NULL
                 AND message.dedupe_key = json_extract(requested.value, '$.publicationKey')
               ) OR (
                 json_extract(requested.value, '$.publicationKey') IS NULL
                 AND message.id = json_extract(requested.value, '$.id')
               )
             WHERE (
               SELECT count(*) FROM system_notification_deliveries AS existing
               WHERE existing.message_id = message.id
             ) != (
               SELECT count(*) FROM json_each(?2) AS delivery
               WHERE json_extract(delivery.value, '$.messageId') =
                 json_extract(requested.value, '$.id')
             )
           )
         THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(payload.messages, payload.deliveries),
  ]
}
