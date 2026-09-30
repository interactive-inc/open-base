import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { toSystemNotificationDelivery } from "@system/infrastructure/repositories/notifications/lib/to-system-notification-delivery"
import { describe, expect, test } from "bun:test"

describe("toSystemNotificationDelivery", () => {
  test("D1 rowをDeliveryへ復元し、壊れた時系列と型を拒否する", () => {
    const delivery = toSystemNotificationDelivery({
      id: testLiteralId("delivery-1"),
      message_id: testLiteralId("message-1"),
      recipient_account_id: testAccountId("account-1"),
      delivered_at: 2_000,
      read_at: null,
    })

    expect(delivery).not.toBeInstanceOf(Error)
    if (delivery instanceof Error) return
    expect(String(delivery.recipientAccountId)).toBe(testAccountId("account-1"))
    expect(delivery.deliveredAt).toEqual(new Date(2_000))
    expect(
      toSystemNotificationDelivery({
        id: testLiteralId("delivery-1"),
        message_id: testLiteralId("message-1"),
        recipient_account_id: testAccountId("account-1"),
        delivered_at: 2_000,
        read_at: 1_999,
      }),
    ).toBeInstanceOf(Error)
    expect(toSystemNotificationDelivery("not a row")).toBeInstanceOf(Error)
  })
})
