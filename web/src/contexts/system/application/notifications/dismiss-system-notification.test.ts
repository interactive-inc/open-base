import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"
import { DismissSystemNotification } from "@system/application/notifications/dismiss-system-notification"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { notificationDeliveryIdSchema } from "@system/domain/schemas/notifications/notification-delivery-id.schema"
import { describe, expect, test } from "bun:test"

const deliveryId = notificationDeliveryIdSchema.parse(testLiteralId("delivery-1"))
const recipientAccountId = zAccountId.parse(testAccountId("account-1"))

function createDelivery(dismissedAt: Date | null = null): NotificationDeliveryEntity {
  const delivery = NotificationDeliveryEntity.create({
    id: deliveryId,
    messageId: testLiteralId("message-1"),
    recipientAccountId,
    deliveredAt: new Date(1_000),
    readAt: null,
    dismissedAt,
  })
  if (delivery instanceof Error) throw delivery
  return delivery
}

function createRepository(
  delivery: NotificationDeliveryEntity | null | Error,
  persisted: boolean | Error = true,
) {
  const writes: Array<Date> = []
  return {
    writes,
    repository: {
      findDeliveryByIdForAccount: async () => delivery,
      dismissDelivery: async (_id: unknown, _account: unknown, dismissedAt: Date) => {
        writes.push(dismissedAt)
        return persisted
      },
    },
  }
}

describe("DismissSystemNotification", () => {
  test("Entityの遷移を経て非表示時刻を保存する", async () => {
    const { repository, writes } = createRepository(createDelivery())
    const result = await new DismissSystemNotification({
      notificationRepository: repository,
    }).execute({ deliveryId, recipientAccountId, dismissedAt: new Date(2_000) })

    expect(result).toMatchObject({ kind: "dismissed" })
    if (result instanceof Error || result.kind !== "dismissed") return
    expect(result.delivery.dismissedAt).toEqual(new Date(2_000))
    expect(writes).toEqual([new Date(2_000)])
  })

  test("不在・非表示済み・同時更新で失ったDeliveryはnot_foundにする", async () => {
    for (const { delivery, persisted } of [
      { delivery: null, persisted: true },
      { delivery: createDelivery(new Date(1_500)), persisted: true },
      { delivery: createDelivery(), persisted: false },
    ]) {
      const { repository } = createRepository(delivery, persisted)
      expect(
        await new DismissSystemNotification({ notificationRepository: repository }).execute({
          deliveryId,
          recipientAccountId,
          dismissedAt: new Date(2_000),
        }),
      ).toEqual({ kind: "not_found" })
    }
  })

  test("配信前の非表示と不正時刻は保存せず拒否する", async () => {
    const { repository, writes } = createRepository(createDelivery())
    const useCase = new DismissSystemNotification({ notificationRepository: repository })

    expect(
      await useCase.execute({ deliveryId, recipientAccountId, dismissedAt: new Date(500) }),
    ).toEqual({ kind: "rejected", reason: "dismiss_before_delivery" })
    expect(
      await useCase.execute({ deliveryId, recipientAccountId, dismissedAt: new Date(Number.NaN) }),
    ).toEqual({ kind: "rejected", reason: "invalid_shape" })
    expect(writes).toEqual([])
  })

  test("読取・保存の失敗はErrorとして返す", async () => {
    const failure = new Error("unavailable")
    for (const { delivery, persisted } of [
      { delivery: failure, persisted: true },
      { delivery: createDelivery(), persisted: failure },
    ]) {
      const { repository } = createRepository(delivery, persisted)
      expect(
        await new DismissSystemNotification({ notificationRepository: repository }).execute({
          deliveryId,
          recipientAccountId,
          dismissedAt: new Date(2_000),
        }),
      ).toBe(failure)
    }
  })
})
