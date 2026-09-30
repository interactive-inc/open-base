import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { InvalidNotificationDeliveryBatchError } from "@system/domain/errors"
import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { describe, expect, test } from "bun:test"

function createDelivery(
  id: string,
  messageId: string,
  accountId: string,
): NotificationDeliveryEntity {
  const delivery = NotificationDeliveryEntity.create({
    id,
    messageId,
    recipientAccountId: accountId,
    deliveredAt: new Date("2026-08-11T00:00:00.000Z"),
    readAt: null,
    dismissedAt: null,
  })

  if (!(delivery instanceof NotificationDeliveryEntity)) throw delivery

  return delivery
}

describe("NotificationDeliveryBatchValue", () => {
  test("broadcastをconcreteなAccount deliveryのimmutable fan-outとして表す", () => {
    const first = createDelivery(
      testLiteralId("delivery-1"),
      testLiteralId("message-1"),
      testAccountId("account-1"),
    )
    const second = createDelivery(
      testLiteralId("delivery-2"),
      testLiteralId("message-1"),
      testAccountId("account-2"),
    )
    const input = [first, second]
    const batch = NotificationDeliveryBatchValue.create(input)

    expect(batch).toBeInstanceOf(NotificationDeliveryBatchValue)
    if (!(batch instanceof NotificationDeliveryBatchValue)) return

    expect(batch.deliveries).toEqual([first, second])
    expect(Object.isFrozen(batch)).toBe(true)
    expect(Object.isFrozen(batch.deliveries)).toBe(true)

    input.pop()
    expect(batch.deliveries).toEqual([first, second])
  })

  test("同じAccountでも別message、同じmessageでも別Accountなら共存できる", () => {
    const batch = NotificationDeliveryBatchValue.create([
      createDelivery(
        testLiteralId("delivery-1"),
        testLiteralId("message-1"),
        testAccountId("account-1"),
      ),
      createDelivery(
        testLiteralId("delivery-2"),
        testLiteralId("message-1"),
        testAccountId("account-2"),
      ),
      createDelivery(
        testLiteralId("delivery-3"),
        testLiteralId("message-2"),
        testAccountId("account-1"),
      ),
    ])

    expect(batch).toBeInstanceOf(NotificationDeliveryBatchValue)
  })

  test("空fan-outを安全なno-opとして表せる", () => {
    const batch = NotificationDeliveryBatchValue.create([])

    expect(batch).toBeInstanceOf(NotificationDeliveryBatchValue)
    if (batch instanceof NotificationDeliveryBatchValue) {
      expect(batch.deliveries).toEqual([])
    }
  })

  test("重複delivery IDを拒否する", () => {
    const result = NotificationDeliveryBatchValue.create([
      createDelivery(
        testLiteralId("delivery-1"),
        testLiteralId("message-1"),
        testAccountId("account-1"),
      ),
      createDelivery(
        testLiteralId("delivery-1"),
        testLiteralId("message-1"),
        testAccountId("account-2"),
      ),
    ])

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
    if (result instanceof InvalidNotificationDeliveryBatchError) {
      expect(result.reason).toBe("duplicate_delivery_id")
    }
  })

  test("同じMessage/Accountへの重複配信をIDが違っても拒否する", () => {
    const result = NotificationDeliveryBatchValue.create([
      createDelivery(
        testLiteralId("delivery-1"),
        testLiteralId("message-1"),
        testAccountId("account-1"),
      ),
      createDelivery(
        testLiteralId("delivery-2"),
        testLiteralId("message-1"),
        testAccountId("account-1"),
      ),
    ])

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
    if (result instanceof InvalidNotificationDeliveryBatchError) {
      expect(result.reason).toBe("duplicate_message_recipient")
    }
  })

  test.each([[null], [{}], [[{ recipientAccountId: null }]]])(
    "entity以外のbatch inputをfail closedで拒否する: %p",
    (input) => {
      const result = NotificationDeliveryBatchValue.create(input)

      expect(result).toBeInstanceOf(InvalidNotificationDeliveryBatchError)
      if (result instanceof InvalidNotificationDeliveryBatchError) {
        expect(result.reason).toBe("invalid_shape")
      }
    },
  )
})
