import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import type { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { describe, expect, test } from "bun:test"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"

const unreachableRepository: Pick<SystemNotificationRepository, "publish"> = {
  publish: () => Promise.reject(new Error("repository must not be called")),
}

describe("PublishSystemNotification", () => {
  test("空配信を拒否する", async () => {
    const publish = new PublishSystemNotification({
      notificationRepository: unreachableRepository,
    })

    expect(
      await publish.execute({ message: createMessage("message-1"), deliveries: createBatch([]) }),
    ).toEqual({ kind: "rejected", reason: "empty_deliveries" })
  })

  test.each([
    {
      reason: "message_mismatch" as const,
      delivery: () => createDelivery("delivery-1", "message-other", new Date(2_000), null),
    },
    {
      reason: "delivery_before_message" as const,
      delivery: () => createDelivery("delivery-1", "message-1", new Date(999), null),
    },
    {
      reason: "already_read" as const,
      delivery: () => createDelivery("delivery-1", "message-1", new Date(2_000), new Date(3_000)),
    },
  ])("$reason を永続化前に拒否する", async ({ reason, delivery }) => {
    const publish = new PublishSystemNotification({
      notificationRepository: unreachableRepository,
    })

    expect(
      await publish.execute({
        message: createMessage("message-1"),
        deliveries: createBatch([delivery()]),
      }),
    ).toEqual({ kind: "rejected", reason })
  })
})

function createMessage(id: string): NotificationMessageEntity {
  const message = NotificationMessageEntity.create({
    id: testLiteralId(id),
    kind: "system:test.created",
    title: "notification",
    body: null,
    source: null,
    createdAt: new Date(1_000),
  })
  if (message instanceof Error) throw message

  return message
}

function createDelivery(
  id: string,
  messageId: string,
  deliveredAt: Date,
  readAt: Date | null,
): NotificationDeliveryEntity {
  const delivery = NotificationDeliveryEntity.create({
    id: testLiteralId(id),
    messageId: testLiteralId(messageId),
    recipientAccountId: testAccountId("account-1"),
    deliveredAt,
    readAt,
    dismissedAt: null,
  })
  if (delivery instanceof Error) throw delivery

  return delivery
}

function createBatch(
  deliveries: Array<NotificationDeliveryEntity>,
): NotificationDeliveryBatchValue {
  const batch = NotificationDeliveryBatchValue.create(deliveries)
  if (batch instanceof Error) throw batch

  return batch
}
