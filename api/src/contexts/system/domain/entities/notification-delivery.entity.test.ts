import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { InvalidNotificationDeliveryError } from "@system/domain/errors"
import { NotificationDeliveryEntity } from "@system/domain/entities/notification-delivery.entity"
import { describe, expect, test } from "bun:test"

const validProps = {
  id: testLiteralId("delivery-1"),
  messageId: testLiteralId("message-1"),
  recipientAccountId: testAccountId("account-1"),
  deliveredAt: new Date("2026-08-11T00:00:00.000Z"),
  readAt: null,
  dismissedAt: null,
} as const

describe("NotificationDeliveryEntity", () => {
  test("nullable recipientを使わずconcreteなAccountEntity deliveryを作る", () => {
    const deliveredAt = new Date(validProps.deliveredAt)
    const delivery = NotificationDeliveryEntity.create({ ...validProps, deliveredAt })

    expect(delivery).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(delivery instanceof NotificationDeliveryEntity)) return

    expect(delivery).toMatchObject({
      id: testLiteralId("delivery-1"),
      messageId: testLiteralId("message-1"),
      recipientAccountId: testAccountId("account-1"),
      isRead: false,
    })
    expect(delivery.readAt).toBeNull()
    expect(Object.isFrozen(delivery)).toBe(true)

    deliveredAt.setUTCFullYear(2030)
    expect(delivery.deliveredAt).toEqual(validProps.deliveredAt)

    const exposedDate = delivery.deliveredAt
    exposedDate.setUTCFullYear(2031)
    expect(delivery.deliveredAt).toEqual(validProps.deliveredAt)
  })

  test("既読化は単調かつ冪等で、元のdeliveryを変更しない", () => {
    const delivery = NotificationDeliveryEntity.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(delivery instanceof NotificationDeliveryEntity)) return

    const readAt = new Date("2026-08-11T00:01:00.000Z")
    const read = delivery.markRead(readAt)
    expect(read).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(read instanceof NotificationDeliveryEntity)) return

    expect(delivery.isRead).toBe(false)
    expect(read.isRead).toBe(true)
    expect(read.readAt).toEqual(readAt)
    expect(read.markRead(new Date("2026-08-11T00:02:00.000Z"))).toBe(read)

    const regressed = read.markRead(new Date("2026-08-11T00:00:30.000Z"))
    expect(regressed).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (regressed instanceof InvalidNotificationDeliveryError) {
      expect(regressed.reason).toBe("transition_before_last_update")
    }
  })

  test("配信前の既読を拒否する", () => {
    const delivery = NotificationDeliveryEntity.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(delivery instanceof NotificationDeliveryEntity)) return

    const result = delivery.markRead(new Date("2026-08-10T23:59:59.999Z"))

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (result instanceof InvalidNotificationDeliveryError) {
      expect(result.reason).toBe("read_before_delivery")
    }
  })

  test("破棄の記録を保ち、破棄後の既読を拒否する", () => {
    const delivery = NotificationDeliveryEntity.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(delivery instanceof NotificationDeliveryEntity)) return

    const dismissedAt = new Date("2026-08-11T00:02:00.000Z")
    const dismissed = delivery.dismiss(dismissedAt)
    expect(dismissed).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(dismissed instanceof NotificationDeliveryEntity)) return

    expect(delivery.isDismissed).toBe(false)
    expect(dismissed.isDismissed).toBe(true)
    expect(dismissed.dismissedAt).toEqual(dismissedAt)
    expect(dismissed.dismiss(new Date("2026-08-11T00:03:00.000Z"))).toBe(dismissed)
    expect(dismissed.markRead(new Date("2026-08-11T00:03:00.000Z"))).toMatchObject({
      reason: "dismissed",
    })
    expect(delivery.dismiss(new Date("2026-08-10T23:59:59.999Z"))).toMatchObject({
      reason: "dismiss_before_delivery",
    })
  })

  test.each([
    ["empty delivery id", { ...validProps, id: "" }],
    ["empty message id", { ...validProps, messageId: "" }],
    ["empty AccountEntity id", { ...validProps, recipientAccountId: "" }],
    ["nullable recipient", { ...validProps, recipientAccountId: null }],
    ["invalid delivery clock", { ...validProps, deliveredAt: new Date(Number.NaN) }],
    ["read before delivery", { ...validProps, readAt: new Date("2026-08-10T23:59:59.999Z") }],
    ["retired user recipient", { ...validProps, userId: "50ea5eee-5cb5-4870-911a-e57ee3f7a81a" }],
    [
      "omitted dismissal state",
      {
        id: validProps.id,
        messageId: validProps.messageId,
        recipientAccountId: validProps.recipientAccountId,
        deliveredAt: validProps.deliveredAt,
        readAt: validProps.readAt,
      },
    ],
  ])("fails closed for %s", (_name, input) => {
    const result = NotificationDeliveryEntity.create(input)

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
  })

  test("不正な既読時刻を例外にせずfail closedで拒否する", () => {
    const delivery = NotificationDeliveryEntity.create(validProps)
    expect(delivery).toBeInstanceOf(NotificationDeliveryEntity)
    if (!(delivery instanceof NotificationDeliveryEntity)) return

    const result = delivery.markRead(new Date(Number.NaN))

    expect(result).toBeInstanceOf(InvalidNotificationDeliveryError)
    if (result instanceof InvalidNotificationDeliveryError) {
      expect(result.reason).toBe("invalid_shape")
    }
  })
})
