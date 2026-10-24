import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemAuditEventInput } from "@system/domain/entities/system-audit-event.entity"
import { describe, expect, test } from "bun:test"

describe("SystemAuditEventEntity.create", () => {
  test("creates an immutable storage-independent event for a string AccountEntity ID", () => {
    const event = SystemAuditEventEntity.create({
      actorAccountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: '{"source":"api"}',
      occurredAt: new Date("2026-01-01T00:00:00.123Z"),
    })

    expect(event).not.toBeInstanceOf(Error)
    if (event instanceof Error) return

    expect(event).toMatchObject({
      actorAccountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      outcome: "succeeded",
      metadataJson: '{"source":"api"}',
      occurredAtEpochMilliseconds: 1_767_225_600_123,
    })
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/u)
    expect(Object.isFrozen(event)).toBe(true)
  })

  test.each(["account-7", null])(
    "accepts opaque and anonymous AccountEntity actors: %p",
    (actorAccountId) => {
      const event = SystemAuditEventEntity.create({
        actorAccountId,
        action: "auth.session.logout",
        targetType: "account",
        targetId: null,
        outcome: "succeeded",
        reasonCode: null,
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson: null,
        occurredAt: new Date(0),
      })

      expect(event).not.toBeInstanceOf(Error)
      if (event instanceof Error) return
      expect(event.actorAccountId).toBe(actorAccountId)
    },
  )

  test.each([
    ["actorAccountId", true],
    ["actorAccountId", 7],
    ["actorAccountId", " "],
    ["actorAccountId", "x".repeat(257)],
    ["action", "not valid"],
    ["targetType", "not valid"],
    ["targetId", ""],
    ["outcome", "unknown"],
    ["reasonCode", ""],
    ["authorizationJson", "{"],
    ["occurredAt", new Date(Number.NaN)],
  ])("fails closed for invalid %s", (property, value) => {
    const input = {
      actorAccountId: null,
      action: "auth.session.logout",
      targetType: "account",
      targetId: null,
      outcome: "failed",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: new Date(0),
    } satisfies SystemAuditEventInput
    Object.defineProperty(input, property, { value })

    expect(SystemAuditEventEntity.create(input)).toBeInstanceOf(Error)
  })
})
