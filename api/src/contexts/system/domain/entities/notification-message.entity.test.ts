import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { InvalidNotificationMessageError } from "@system/domain/errors"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import { describe, expect, test } from "bun:test"

const validProps = {
  id: testLiteralId("message-1"),
  kind: "system:security.alert",
  title: "Security setting changed",
  body: "Review the change\nfrom your account settings.",
  source: { type: "system:account", id: testAccountId("account-1") },
  createdAt: new Date("2026-08-11T00:00:00.000Z"),
} as const

describe("NotificationMessageEntity", () => {
  test("recipientとread stateを持たないimmutableなplain-text messageを作る", () => {
    const source: { type: string; id: string } = { ...validProps.source }
    const createdAt = new Date(validProps.createdAt)
    const message = NotificationMessageEntity.create({ ...validProps, source, createdAt })

    expect(message).toBeInstanceOf(NotificationMessageEntity)
    if (!(message instanceof NotificationMessageEntity)) return

    expect(message).toMatchObject({
      id: testLiteralId("message-1"),
      kind: "system:security.alert",
      title: "Security setting changed",
      body: "Review the change\nfrom your account settings.",
      source: { type: "system:account", id: testAccountId("account-1") },
    })
    expect("recipientAccountId" in message).toBe(false)
    expect("readAt" in message).toBe(false)
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.source)).toBe(true)

    source.id = "changed"
    createdAt.setUTCFullYear(2030)
    expect(message.source?.id).toBe(testAccountId("account-1"))
    expect(message.createdAt).toEqual(validProps.createdAt)

    const exposedDate = message.createdAt
    exposedDate.setUTCFullYear(2031)
    expect(message.createdAt).toEqual(validProps.createdAt)
  })

  test("bodyとsourceを持たないmessageも明示的なnullで表す", () => {
    const message = NotificationMessageEntity.create({ ...validProps, body: null, source: null })

    expect(message).toBeInstanceOf(NotificationMessageEntity)
    if (!(message instanceof NotificationMessageEntity)) return
    expect(message.body).toBeNull()
    expect(message.source).toBeNull()
    expect(message.action).toBeNull()
    expect(message.resourceScope).toBeNull()
    expect(message.priority).toBe("normal")
  })

  test("opaque actionとresource scopeをimmutableな参照として保持する", () => {
    const action = { type: "care:shift_request", id: "facility-1" }
    const resourceScope = { type: "care:facility", id: "facility-1" }
    const message = NotificationMessageEntity.create({
      ...validProps,
      action,
      resourceScope,
      priority: "high",
    })
    expect(message).toBeInstanceOf(NotificationMessageEntity)
    if (!(message instanceof NotificationMessageEntity)) return
    action.id = "facility-2"
    resourceScope.id = "facility-2"
    expect(message.action?.id).toBe("facility-1")
    expect(message.resourceScope?.id).toBe("facility-1")
    expect(Object.isFrozen(message.action)).toBe(true)
    expect(Object.isFrozen(message.resourceScope)).toBe(true)
  })

  test.each([
    ["empty id", { ...validProps, id: "" }],
    ["unnamespaced kind", { ...validProps, kind: "security_alert" }],
    ["uppercase namespace", { ...validProps, kind: "System:security.alert" }],
    ["blank title", { ...validProps, title: "   " }],
    ["multiline title", { ...validProps, title: "line 1\nline 2" }],
    ["blank body", { ...validProps, body: "\n\t" }],
    ["body control character", { ...validProps, body: "unsafe\u0000body" }],
    ["oversized body", { ...validProps, body: "x".repeat(10_001) }],
    ["unnamespaced source", { ...validProps, source: { type: "account", id: "1" } }],
    ["empty source id", { ...validProps, source: { type: "system:account", id: "" } }],
    ["empty publication key", { ...validProps, publicationKey: "" }],
    ["oversized publication key", { ...validProps, publicationKey: "x".repeat(513) }],
    ["invalid priority", { ...validProps, priority: "urgent" }],
    ["unnamespaced action", { ...validProps, action: { type: "shift", id: "1" } }],
    ["empty scope id", { ...validProps, resourceScope: { type: "care:facility", id: "" } }],
    ["invalid clock", { ...validProps, createdAt: new Date(Number.NaN) }],
    ["unknown field", { ...validProps, recipientAccountId: testAccountId("account-1") }],
  ])("fails closed for %s", (_name, input) => {
    const result = NotificationMessageEntity.create(input)

    expect(result).toBeInstanceOf(InvalidNotificationMessageError)
    if (result instanceof InvalidNotificationMessageError) {
      expect(result.reason).toBe("invalid_shape")
    }
  })
})
