import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { toSystemNotificationMessage } from "@system/infrastructure/repositories/notifications/lib/to-system-notification-message"
import { describe, expect, test } from "bun:test"

describe("toSystemNotificationMessage", () => {
  test("D1 rowをMessageへ復元し、壊れたsource pairを拒否する", () => {
    const message = toSystemNotificationMessage({
      id: testLiteralId("message-1"),
      kind: "system:test.created",
      title: "plain title",
      body: null,
      source_type: "system:test.source",
      source_id: "source-1",
      action_type: "system:test.action",
      action_id: "target-1",
      resource_type: "system:test.scope",
      resource_id: "resource-1",
      priority: "high",
      created_at: 1_000,
    })

    expect(message).not.toBeInstanceOf(Error)
    if (message instanceof Error) return
    expect(message.source).toEqual({ type: "system:test.source", id: "source-1" })
    expect(message.action).toEqual({ type: "system:test.action", id: "target-1" })
    expect(message.resourceScope).toEqual({ type: "system:test.scope", id: "resource-1" })
    expect(message.priority).toBe("high")
    expect(message.createdAt).toEqual(new Date(1_000))
    expect(
      toSystemNotificationMessage({
        id: testLiteralId("message-1"),
        kind: "system:test.created",
        title: "plain title",
        body: null,
        source_type: "system:test.source",
        source_id: null,
        created_at: 1_000,
      }),
    ).toBeInstanceOf(Error)
    expect(
      toSystemNotificationMessage({
        id: testLiteralId("message-1"),
        kind: "system:test.created",
        title: "plain title",
        body: null,
        source_type: null,
        source_id: null,
        action_type: "system:test.action",
        action_id: null,
        created_at: 1_000,
      }),
    ).toBeInstanceOf(Error)
  })
})
