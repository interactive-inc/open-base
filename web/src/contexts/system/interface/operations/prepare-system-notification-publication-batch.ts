import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"

type Reference = Readonly<{ type: string; id: string }>

export type SystemNotificationPublicationInput = Readonly<{
  message: Readonly<{
    id: string
    kind: string
    title: string
    body: string | null
    source: Reference | null
    action: Reference | null
    resourceScope: Reference | null
    priority: "low" | "normal" | "high" | "critical"
    publicationKey: string | null
    createdAt: Date
  }>
  deliveries: ReadonlyArray<Readonly<{ id: string; recipientAccountId: string; deliveredAt: Date }>>
}>

/** 呼び出し側の業務statementと同じD1 batchに追加するportableなSystem通知操作。 */
export function prepareSystemNotificationPublicationBatch(
  input: Readonly<{
    database: D1Database
    publications: ReadonlyArray<SystemNotificationPublicationInput>
  }>,
): ReadonlyArray<D1PreparedStatement> | Error {
  const publications = []
  for (const publication of input.publications) {
    const message = NotificationMessageEntity.create(publication.message)
    if (message instanceof Error) return message
    const deliveries = []
    for (const candidate of publication.deliveries) {
      const delivery = NotificationDeliveryEntity.create({
        ...candidate,
        messageId: message.id,
        readAt: null,
        dismissedAt: null,
      })
      if (delivery instanceof Error) return delivery
      deliveries.push(delivery)
    }
    const batch = NotificationDeliveryBatchValue.create(deliveries)
    if (batch instanceof Error) return batch
    publications.push({ message, deliveries: batch })
  }
  return new SystemNotificationRepository({
    context: { env: { DB: input.database } },
  }).preparePublishBatch(publications)
}
