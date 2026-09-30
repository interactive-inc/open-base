import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { exportAuditEvents } from "@/lib/api/export-audit-events"

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock("@/lib/api/hc-client", () => ({ createClient: mocks.createClient }))

afterEach(() => vi.clearAllMocks())

describe("exportAuditEvents", () => {
  test("posts the typed range with no-store and returns the response body unread", async () => {
    const body = new ReadableStream<Uint8Array>()
    const response = {
      ok: true,
      status: 200,
      body,
      json: vi.fn(),
      text: vi.fn(),
      blob: vi.fn(),
    }
    const post = vi.fn().mockResolvedValue(response)
    mocks.createClient.mockResolvedValue({
      company: { "audit-event-exports": { $post: post } },
    })
    const request = {
      actor_account_id: "account_01JY2M3N4P5Q6R7S8T9V0W1X2Y",
      action: "custom.action",
      target_type: "custom_target",
      target_id: "target-1",
      outcome: "succeeded" as const,
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
    }

    await expect(exportAuditEvents(request)).resolves.toBe(response)
    expect(post).toHaveBeenCalledWith({ json: request }, { init: { cache: "no-store" } })
    expect(response.json).not.toHaveBeenCalled()
    expect(response.text).not.toHaveBeenCalled()
    expect(response.blob).not.toHaveBeenCalled()
  })
})
