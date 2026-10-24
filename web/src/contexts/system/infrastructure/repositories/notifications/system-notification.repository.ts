import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import type { NotificationDeliveryId } from "@system/domain/schemas/notifications/notification-delivery-id.schema"
import type { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import type { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import type { SystemD1Context } from "@system/configuration/system-context"
import { toSystemNotificationDelivery } from "@system/infrastructure/repositories/notifications/lib/to-system-notification-delivery"
import { toSystemNotificationMessage } from "@system/infrastructure/repositories/notifications/lib/to-system-notification-message"
import {
  prepareSystemNotificationPublicationBatch,
  type SystemNotificationPublication,
} from "@system/infrastructure/repositories/notifications/lib/prepare-system-notification-publication-batch"

const maximumPublicationPayloadBytes = 1_000_000

type Props = Readonly<{
  context: SystemD1Context
}>

type DeliveryPayload = Readonly<{
  id: string
  messageId: string
  recipientAccountId: string
  deliveredAt: number
  readAt: number | null
}>

export type SystemNotification = Readonly<{
  delivery: NotificationDeliveryEntity
  message: NotificationMessageEntity
}>

export type SystemNotificationPage = Readonly<{
  items: ReadonlyArray<SystemNotification>
  total: number
}>

/** 既存の通知も含む、Account宛ての保存済み通知の読み取り投影。 */
export type SystemNotificationRecord = Readonly<{
  id: string
  messageId: string
  deliveredAt: number
  readAt: number | null
  kind: string
  title: string
  body: string | null
  priority: "low" | "normal" | "high" | "critical"
  actionUrl: string | null
  actionType: string | null
  actionId: string | null
  resourceScope: Readonly<{ type: string; id: string }> | null
}>

export type ListSystemNotificationsProps = Readonly<{
  recipientAccountId: AccountId
  read: boolean | null
  limit: number
  offset: number
}>

export type MarkNotificationDeliveryReadProps = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
  readAt: Date
}>
type SystemNotificationRepositoryContext = Props
type Context = SystemNotificationRepositoryContext

/** canonical MessageとAccount Deliveryだけを扱うportable D1 repository。 */
export class SystemNotificationRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 業務変更と通知を同じtransactionへ保存するための検証済みstatement。 */
  preparePublish(
    message: NotificationMessageEntity,
    deliveries: NotificationDeliveryBatchValue,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    const payload = toDeliveryPayload(deliveries)
    if (payload instanceof Error) return payload
    const database = this.c.context.env.DB
    return [
      prepareMessageInsert(database, message),
      ...(message.resourceScope === null ? [] : [prepareResourceScopeInsert(database, message)]),
      prepareDeliveryFanOut(database, message, payload),
      preparePublicationInvariant(database, message, payload),
    ]
  }

  /** 複数Messageのfan-outを件数に依存しない4文で他の業務statementと同時に確定する。 */
  preparePublishBatch(
    publications: ReadonlyArray<SystemNotificationPublication>,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    return prepareSystemNotificationPublicationBatch(this.c.context.env.DB, publications)
  }

  async listExistingPublicationKeys(
    publicationKeys: ReadonlyArray<string>,
  ): Promise<ReadonlySet<string> | Error> {
    if (
      !Array.isArray(publicationKeys) ||
      publicationKeys.some((key) => typeof key !== "string" || key.length < 1 || key.length > 512)
    ) {
      return new Error("System Notification publication keys are invalid")
    }
    if (publicationKeys.length === 0) return new Set<string>()
    const payload = JSON.stringify([...new Set(publicationKeys)])
    if (new TextEncoder().encode(payload).byteLength > maximumPublicationPayloadBytes) {
      return new Error("System Notification publication keys payload is too large")
    }
    try {
      const found = await this.c.context.env.DB.prepare(
        `SELECT dedupe_key AS publication_key
           FROM system_notification_messages
          WHERE dedupe_key IN (SELECT value FROM json_each(?1))`,
      )
        .bind(payload)
        .all<{ publication_key: string }>()
      return new Set(found.results.map((row) => row.publication_key))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("System Notification key lookup failed")
    }
  }

  async publish(
    message: NotificationMessageEntity,
    deliveries: NotificationDeliveryBatchValue,
  ): Promise<void | Error> {
    const statements = this.preparePublish(message, deliveries)
    if (statements instanceof Error) return statements
    try {
      const results = await this.c.context.env.DB.batch([...statements])
      return results.length === statements.length && results.every((result) => result.success)
        ? undefined
        : new Error("System Notification publication did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to publish System Notification")
    }
  }

  async findDeliveryByIdForAccount(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ): Promise<NotificationDeliveryEntity | null | Error> {
    try {
      const row = await prepareDeliverySelect(
        this.c.context.env.DB,
        deliveryId,
        recipientAccountId,
      ).first<Record<string, unknown>>()

      return row === null ? null : toSystemNotificationDelivery(row)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to find System Notification Delivery")
    }
  }

  async findByDeliveryIdForAccount(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ): Promise<SystemNotification | null | Error> {
    try {
      const row = await prepareNotificationSelect(
        this.c.context.env.DB,
        deliveryId,
        recipientAccountId,
      ).first<Record<string, unknown>>()

      return row === null ? null : toSystemNotification(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System Notification")
    }
  }

  async findMany(props: ListSystemNotificationsProps): Promise<SystemNotificationPage | Error> {
    try {
      const database = this.c.context.env.DB
      const results = await database.batch([
        database
          .prepare(
            `SELECT
               delivery.id AS delivery_id,
               delivery.message_id,
               delivery.recipient_account_id,
               delivery.delivered_at,
               delivery.read_at,
               delivery.dismissed_at,
               message.id AS message_id_value,
               message.kind,
               message.title,
               message.body,
               message.source_type,
               message.source_id,
               message.priority,
               message.action_type,
               message.action_id,
               message.dedupe_key,
               scope.resource_type,
               scope.resource_id,
               message.created_at
             FROM system_notification_deliveries AS delivery
             INNER JOIN system_notification_messages AS message ON message.id = delivery.message_id
             LEFT JOIN system_notification_resource_scopes AS scope ON scope.message_id = message.id
             WHERE delivery.recipient_account_id = ?1
               AND delivery.dismissed_at IS NULL
               AND (?2 IS NULL OR (delivery.read_at IS NOT NULL) = ?2)
             ORDER BY delivery.delivered_at DESC, delivery.id DESC
             LIMIT ?3 OFFSET ?4`,
          )
          .bind(
            props.recipientAccountId,
            props.read === null ? null : props.read ? 1 : 0,
            props.limit,
            props.offset,
          ),
        database
          .prepare(
            `SELECT count(*) AS total
             FROM system_notification_deliveries
             WHERE recipient_account_id = ?1
               AND dismissed_at IS NULL
               AND (?2 IS NULL OR (read_at IS NOT NULL) = ?2)`,
          )
          .bind(props.recipientAccountId, props.read === null ? null : props.read ? 1 : 0),
      ])

      if (results.length !== 2 || results.some((result) => !result.success)) {
        return new Error("System Notification list did not succeed")
      }

      const items: Array<SystemNotification> = []
      for (const row of results[0]?.results ?? []) {
        const notification = toSystemNotification(row)
        if (notification instanceof Error) return notification
        items.push(notification)
      }

      const total = (results[1]?.results?.[0] as Record<string, unknown> | undefined)?.total
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
        return new Error("System Notification total is invalid")
      }

      return Object.freeze({ items: Object.freeze(items), total })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Notifications")
    }
  }

  /** 旧kind/action URLを再解釈せず、受信者の未破棄通知を返す。 */
  async listRecordsForAccount(
    recipientAccountId: AccountId,
    read: boolean | null = null,
    deliveryId: string | null = null,
  ): Promise<ReadonlyArray<SystemNotificationRecord> | Error> {
    try {
      const result = await this.c.context.env.DB.prepare(
        `SELECT delivery.id, delivery.message_id, delivery.delivered_at, delivery.read_at,
                message.kind, message.title, message.body, message.priority,
                message.action_url, message.action_type, message.action_id,
                scope.resource_type, scope.resource_id
           FROM system_notification_deliveries AS delivery
           INNER JOIN system_notification_messages AS message ON message.id = delivery.message_id
           LEFT JOIN system_notification_resource_scopes AS scope ON scope.message_id = message.id
          WHERE delivery.recipient_account_id = ?1
            AND delivery.dismissed_at IS NULL
            AND (?2 IS NULL OR (delivery.read_at IS NOT NULL) = ?2)
            AND (?3 IS NULL OR delivery.id = ?3)`,
      )
        .bind(recipientAccountId, read === null ? null : read ? 1 : 0, deliveryId)
        .all()
      if (!result.success) return new Error("System Notification record list did not succeed")
      const records: Array<SystemNotificationRecord> = []
      for (const raw of result.results) {
        const record = toSystemNotificationRecord(raw)
        if (record instanceof Error) return record
        records.push(record)
      }
      return Object.freeze(records)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to list System Notification records")
    }
  }

  async countUnreadForAccount(recipientAccountId: AccountId): Promise<number | Error> {
    try {
      const total = await this.c.context.env.DB.prepare(
        `SELECT count(*) AS total
           FROM system_notification_deliveries
           WHERE recipient_account_id = ?1 AND read_at IS NULL AND dismissed_at IS NULL`,
      )
        .bind(recipientAccountId)
        .first<number>("total")

      return typeof total === "number" && Number.isSafeInteger(total) && total >= 0
        ? total
        : new Error("System Notification unread count is invalid")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to count unread System Notifications")
    }
  }

  /** 製品側が可視性を確認したdeliveryだけを、受信Accountの既読へ遷移する。 */
  async markSelectedRecordsRead(
    input: Readonly<{
      recipientAccountId: AccountId
      deliveryIds: ReadonlyArray<string>
      readAt: Date
    }>,
  ): Promise<number | Error> {
    if (
      !Array.isArray(input.deliveryIds) ||
      input.deliveryIds.some((id) => typeof id !== "string" || id.length < 1 || id.length > 255) ||
      !(input.readAt instanceof Date) ||
      !Number.isSafeInteger(input.readAt.getTime())
    ) {
      return new Error("System Notification read selection is invalid")
    }
    if (input.deliveryIds.length === 0) return 0
    const payload = JSON.stringify([...new Set(input.deliveryIds)])
    if (new TextEncoder().encode(payload).byteLength > maximumPublicationPayloadBytes) {
      return new Error("System Notification read selection is too large")
    }
    try {
      const result = await this.c.context.env.DB.prepare(
        `UPDATE system_notification_deliveries
            SET read_at = ?1
          WHERE recipient_account_id = ?2
            AND id IN (SELECT value FROM json_each(?3))
            AND read_at IS NULL
            AND dismissed_at IS NULL
            AND delivered_at <= ?1`,
      )
        .bind(input.readAt.getTime(), input.recipientAccountId, payload)
        .run()
      const changes = result.meta.changes
      return Number.isSafeInteger(changes) && changes >= 0 && changes <= input.deliveryIds.length
        ? changes
        : new Error("System Notification read selection count is invalid")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to mark System Notification read")
    }
  }

  async markDeliveryRead(
    props: MarkNotificationDeliveryReadProps,
  ): Promise<NotificationDeliveryEntity | null | Error> {
    try {
      const database = this.c.context.env.DB
      const results = await database.batch([
        database
          .prepare(
            `UPDATE system_notification_deliveries
             SET read_at = coalesce(read_at, ?1)
             WHERE id = ?2
               AND recipient_account_id = ?3
               AND dismissed_at IS NULL
               AND delivered_at <= ?1
               AND (read_at IS NULL OR read_at <= ?1)`,
          )
          .bind(props.readAt.getTime(), props.deliveryId, props.recipientAccountId),
        prepareDeliverySelect(database, props.deliveryId, props.recipientAccountId),
      ])

      if (results.length !== 2 || results.some((result) => !result.success)) {
        return new Error("System Notification read transition did not succeed")
      }

      const rows = results[1]?.results
      if (!Array.isArray(rows) || rows.length > 1) {
        return new Error("System Notification Delivery result is invalid")
      }
      if (rows.length === 0) return null

      const delivery = toSystemNotificationDelivery(rows[0])
      if (delivery instanceof Error) return delivery

      const transition = delivery.markRead(props.readAt)
      if (transition instanceof Error) return transition
      if (!delivery.isRead) {
        return new Error("System Notification read transition was not persisted")
      }

      return delivery
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to mark System Notification Delivery read")
    }
  }

  async markAllDeliveriesRead(
    recipientAccountId: AccountId,
    readAt: Date,
  ): Promise<number | Error> {
    try {
      const result = await this.c.context.env.DB.prepare(
        `UPDATE system_notification_deliveries
           SET read_at = ?1
           WHERE recipient_account_id = ?2
             AND read_at IS NULL
             AND dismissed_at IS NULL
             AND delivered_at <= ?1`,
      )
        .bind(readAt.getTime(), recipientAccountId)
        .run()

      const changes = result.meta.changes
      return Number.isSafeInteger(changes) && changes >= 0
        ? changes
        : new Error("System Notification read-all count is invalid")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to mark all System Notifications read")
    }
  }

  async dismissDelivery(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
    dismissedAt: Date,
  ): Promise<boolean | Error> {
    try {
      const result = await this.c.context.env.DB.prepare(
        `UPDATE system_notification_deliveries
           SET dismissed_at = ?3
           WHERE id = ?1 AND recipient_account_id = ?2
             AND dismissed_at IS NULL AND delivered_at <= ?3`,
      )
        .bind(deliveryId, recipientAccountId, dismissedAt.getTime())
        .run()

      return result.meta.changes === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to dismiss System Notification")
    }
  }
}

function toDeliveryPayload(deliveries: NotificationDeliveryBatchValue): string | Error {
  const values: Array<DeliveryPayload> = deliveries.deliveries.map((delivery) => ({
    id: delivery.id,
    messageId: delivery.messageId,
    recipientAccountId: delivery.recipientAccountId,
    deliveredAt: delivery.deliveredAt.getTime(),
    readAt: delivery.readAt?.getTime() ?? null,
  }))
  const payload = JSON.stringify(values)

  return new TextEncoder().encode(payload).byteLength <= maximumPublicationPayloadBytes
    ? payload
    : new Error("System Notification publication payload is too large")
}

function prepareMessageInsert(
  database: D1Database,
  message: NotificationMessageEntity,
): D1PreparedStatement {
  if (message.publicationKey !== null) {
    return database
      .prepare(
        `INSERT INTO system_notification_messages
           (id, kind, title, body, source_type, source_id, priority,
            action_type, action_id, dedupe_key, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(dedupe_key) DO NOTHING`,
      )
      .bind(
        message.id,
        message.kind,
        message.title,
        message.body,
        message.source?.type ?? null,
        message.source?.id ?? null,
        message.priority,
        message.action?.type ?? null,
        message.action?.id ?? null,
        message.publicationKey,
        message.createdAt.getTime(),
      )
  }
  return database
    .prepare(
      `INSERT INTO system_notification_messages
         (id, kind, title, body, source_type, source_id, priority,
          action_type, action_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      message.id,
      message.kind,
      message.title,
      message.body,
      message.source?.type ?? null,
      message.source?.id ?? null,
      message.priority,
      message.action?.type ?? null,
      message.action?.id ?? null,
      message.createdAt.getTime(),
    )
}

function prepareResourceScopeInsert(
  database: D1Database,
  message: NotificationMessageEntity,
): D1PreparedStatement {
  const scope = message.resourceScope
  if (scope === null) throw new Error("notification resource scope is missing")
  if (message.publicationKey !== null) {
    return database
      .prepare(
        `INSERT INTO system_notification_resource_scopes
           (message_id, resource_type, resource_id)
         SELECT id, ?2, ?3 FROM system_notification_messages WHERE dedupe_key = ?1
         ON CONFLICT(message_id) DO NOTHING`,
      )
      .bind(message.publicationKey, scope.type, scope.id)
  }
  return database
    .prepare(
      `INSERT INTO system_notification_resource_scopes
         (message_id, resource_type, resource_id)
       VALUES (?1, ?2, ?3)`,
    )
    .bind(message.id, scope.type, scope.id)
}

function prepareDeliveryFanOut(
  database: D1Database,
  message: NotificationMessageEntity,
  payload: string,
): D1PreparedStatement {
  if (message.publicationKey !== null) {
    return database
      .prepare(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at, read_at)
         SELECT
           json_extract(item.value, '$.id'),
           message.id,
           json_extract(item.value, '$.recipientAccountId'),
           json_extract(item.value, '$.deliveredAt'),
           NULL
         FROM json_each(?1) AS item
         INNER JOIN system_notification_messages AS message
           ON message.dedupe_key = ?2
         INNER JOIN system_accounts AS account
           ON account.id = json_extract(item.value, '$.recipientAccountId')
          AND account.status = 'active'
         WHERE json_extract(item.value, '$.readAt') IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM system_notification_deliveries AS existing
             WHERE existing.message_id = message.id
               AND existing.recipient_account_id = account.id
           )`,
      )
      .bind(payload, message.publicationKey)
  }
  return database
    .prepare(
      `INSERT INTO system_notification_deliveries
         (id, message_id, recipient_account_id, delivered_at, read_at)
       SELECT
         json_extract(item.value, '$.id'),
         json_extract(item.value, '$.messageId'),
         json_extract(item.value, '$.recipientAccountId'),
         json_extract(item.value, '$.deliveredAt'),
         NULL
       FROM json_each(?1) AS item
       INNER JOIN system_accounts AS account
         ON account.id = json_extract(item.value, '$.recipientAccountId')
        AND account.status = 'active'
       WHERE json_extract(item.value, '$.messageId') = ?2
         AND json_extract(item.value, '$.deliveredAt') >= ?3
         AND json_extract(item.value, '$.readAt') IS NULL`,
    )
    .bind(payload, message.id, message.createdAt.getTime())
}

function preparePublicationInvariant(
  database: D1Database,
  message: NotificationMessageEntity,
  payload: string,
): D1PreparedStatement {
  if (message.publicationKey !== null) {
    return database
      .prepare(
        `SELECT CASE WHEN
           json_array_length(?1) > 0
           AND EXISTS (
             SELECT 1 FROM system_notification_messages
             WHERE dedupe_key = ?2 AND kind = ?3 AND title = ?4 AND body IS ?5
               AND source_type IS ?6 AND source_id IS ?7
               AND priority = ?8 AND action_type IS ?9 AND action_id IS ?10
           )
           AND (
             (?11 IS NULL AND NOT EXISTS (
               SELECT 1 FROM system_notification_resource_scopes AS scope
               INNER JOIN system_notification_messages AS existing
                 ON existing.id = scope.message_id
               WHERE existing.dedupe_key = ?2
             ))
             OR EXISTS (
               SELECT 1 FROM system_notification_resource_scopes AS scope
               INNER JOIN system_notification_messages AS existing
                 ON existing.id = scope.message_id
               WHERE existing.dedupe_key = ?2
                 AND scope.resource_type = ?11 AND scope.resource_id = ?12
             )
           )
           AND (
             SELECT count(*) FROM system_notification_deliveries AS delivery
             INNER JOIN system_notification_messages AS existing
               ON existing.id = delivery.message_id
             WHERE existing.dedupe_key = ?2
           ) = json_array_length(?1)
           AND NOT EXISTS (
             SELECT 1 FROM json_each(?1) AS item
             LEFT JOIN system_notification_deliveries AS delivery
               ON delivery.recipient_account_id = json_extract(item.value, '$.recipientAccountId')
              AND delivery.message_id = (
                SELECT id FROM system_notification_messages WHERE dedupe_key = ?2
              )
             WHERE delivery.id IS NULL
           )
         THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(
        payload,
        message.publicationKey,
        message.kind,
        message.title,
        message.body,
        message.source?.type ?? null,
        message.source?.id ?? null,
        message.priority,
        message.action?.type ?? null,
        message.action?.id ?? null,
        message.resourceScope?.type ?? null,
        message.resourceScope?.id ?? null,
      )
  }
  return database
    .prepare(
      `SELECT CASE WHEN
         json_array_length(?1) > 0
         AND EXISTS (
           SELECT 1 FROM system_notification_messages
           WHERE id = ?2 AND kind = ?3 AND title = ?4 AND body IS ?5
             AND source_type IS ?6 AND source_id IS ?7 AND created_at = ?8
             AND priority = ?9 AND action_type IS ?10 AND action_id IS ?11
         )
         AND (
           (?12 IS NULL AND NOT EXISTS (
             SELECT 1 FROM system_notification_resource_scopes WHERE message_id = ?2
           ))
           OR EXISTS (
             SELECT 1 FROM system_notification_resource_scopes
             WHERE message_id = ?2 AND resource_type = ?12 AND resource_id = ?13
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM json_each(?1) AS item
           LEFT JOIN system_notification_deliveries AS delivery
             ON delivery.id = json_extract(item.value, '$.id')
            AND delivery.message_id = json_extract(item.value, '$.messageId')
            AND delivery.recipient_account_id = json_extract(item.value, '$.recipientAccountId')
            AND delivery.delivered_at = json_extract(item.value, '$.deliveredAt')
            AND delivery.read_at IS NULL
           WHERE delivery.id IS NULL
         )
       THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
      payload,
      message.id,
      message.kind,
      message.title,
      message.body,
      message.source?.type ?? null,
      message.source?.id ?? null,
      message.createdAt.getTime(),
      message.priority,
      message.action?.type ?? null,
      message.action?.id ?? null,
      message.resourceScope?.type ?? null,
      message.resourceScope?.id ?? null,
    )
}

function prepareDeliverySelect(
  database: D1Database,
  deliveryId: NotificationDeliveryId,
  recipientAccountId: AccountId,
): D1PreparedStatement {
  return database
    .prepare(
      `SELECT id, message_id, recipient_account_id, delivered_at, read_at, dismissed_at
       FROM system_notification_deliveries
       WHERE id = ?1 AND recipient_account_id = ?2 AND dismissed_at IS NULL
       LIMIT 1`,
    )
    .bind(deliveryId, recipientAccountId)
}

function prepareNotificationSelect(
  database: D1Database,
  deliveryId: NotificationDeliveryId,
  recipientAccountId: AccountId,
): D1PreparedStatement {
  return database
    .prepare(
      `SELECT
         delivery.id AS delivery_id,
         delivery.message_id,
         delivery.recipient_account_id,
         delivery.delivered_at,
         delivery.read_at,
         delivery.dismissed_at,
         message.id AS message_id_value,
         message.kind,
         message.title,
         message.body,
         message.source_type,
         message.source_id,
         message.priority,
         message.action_type,
         message.action_id,
         message.dedupe_key,
         scope.resource_type,
         scope.resource_id,
         message.created_at
       FROM system_notification_deliveries AS delivery
       INNER JOIN system_notification_messages AS message ON message.id = delivery.message_id
       LEFT JOIN system_notification_resource_scopes AS scope ON scope.message_id = message.id
       WHERE delivery.id = ?1 AND delivery.recipient_account_id = ?2
         AND delivery.dismissed_at IS NULL
       LIMIT 1`,
    )
    .bind(deliveryId, recipientAccountId)
}

function toSystemNotification(row: unknown): SystemNotification | Error {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return new Error("System Notification row is invalid")
  }

  const values = row as Record<string, unknown>
  const delivery = toSystemNotificationDelivery({
    id: values.delivery_id,
    message_id: values.message_id,
    recipient_account_id: values.recipient_account_id,
    delivered_at: values.delivered_at,
    read_at: values.read_at,
    dismissed_at: values.dismissed_at,
  })
  if (delivery instanceof Error) return delivery

  const message = toSystemNotificationMessage({
    id: values.message_id_value,
    kind: values.kind,
    title: values.title,
    body: values.body,
    source_type: values.source_type,
    source_id: values.source_id,
    priority: values.priority,
    action_type: values.action_type,
    action_id: values.action_id,
    dedupe_key: values.dedupe_key,
    resource_type: values.resource_type,
    resource_id: values.resource_id,
    created_at: values.created_at,
  })
  if (message instanceof Error) return message
  if (message.id !== delivery.messageId) {
    return new Error("System Notification Message and Delivery do not match")
  }

  return Object.freeze({ message, delivery })
}

function toSystemNotificationRecord(raw: unknown): SystemNotificationRecord | Error {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return new Error("System Notification record is invalid")
  }
  const row = raw as Record<string, unknown>
  const strings = [row.id, row.message_id, row.kind, row.title]
  const optionalStrings = [row.body, row.action_url, row.action_type, row.action_id]
  if (
    strings.some((value) => typeof value !== "string" || value.length === 0) ||
    optionalStrings.some((value) => value !== null && typeof value !== "string") ||
    typeof row.delivered_at !== "number" ||
    !Number.isSafeInteger(row.delivered_at) ||
    (row.read_at !== null &&
      (typeof row.read_at !== "number" || !Number.isSafeInteger(row.read_at))) ||
    !["low", "normal", "high", "critical"].includes(row.priority as string) ||
    (row.resource_type === null) !== (row.resource_id === null) ||
    (row.resource_type !== null &&
      (typeof row.resource_type !== "string" || typeof row.resource_id !== "string"))
  ) {
    return new Error("System Notification record is invalid")
  }
  return Object.freeze({
    id: row.id as string,
    messageId: row.message_id as string,
    deliveredAt: row.delivered_at as number,
    readAt: row.read_at as number | null,
    kind: row.kind as string,
    title: row.title as string,
    body: row.body as string | null,
    priority: row.priority as SystemNotificationRecord["priority"],
    actionUrl: row.action_url as string | null,
    actionType: row.action_type as string | null,
    actionId: row.action_id as string | null,
    resourceScope:
      row.resource_type === null
        ? null
        : Object.freeze({ type: row.resource_type as string, id: row.resource_id as string }),
  })
}
