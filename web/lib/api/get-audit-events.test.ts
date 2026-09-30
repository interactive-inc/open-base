import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { getAuditEvents } from "@/lib/api/get-audit-events"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  toApiResponseError: vi.fn(),
}))

vi.mock("@/lib/api/hc-client", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/api/to-api-response-error", () => ({
  toApiResponseError: mocks.toApiResponseError,
}))

afterEach(() => vi.clearAllMocks())

describe("getAuditEvents", () => {
  test("passes the exact query with no-store and returns the public summary page", async () => {
    const page = {
      data: [
        {
          event_id: "custom-1",
          request_id: "request-1",
          actor_account_id: "account_01JY2M3N4P5Q6R7S8T9V0W1X2Y",
          actor_employee_id: null,
          action: "custom.action",
          target_type: null,
          target_id: null,
          outcome: "succeeded" as const,
          reason_code: null,
          client_name: "web" as const,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      next_cursor: "next",
      previous_cursor: null,
    }
    const json = vi.fn().mockResolvedValue(page)
    const get = vi.fn().mockResolvedValue({ ok: true, status: 200, json })
    mocks.createClient.mockResolvedValue({ company: { "audit-events": { $get: get } } })
    const query = { action: "custom.action", limit: "25", cursor: "opaque" }

    await expect(getAuditEvents(query)).resolves.toEqual(page)
    expect(get).toHaveBeenCalledWith({ query }, { init: { cache: "no-store" } })
    expect(json).toHaveBeenCalledTimes(1)
  })

  test("preserves the API status and code without reflecting the remote message", async () => {
    const response = { ok: false, status: 403, json: vi.fn() }
    const expected = new ApiResponseError(403, "safe", "audit_read_forbidden")
    const get = vi.fn().mockResolvedValue(response)
    mocks.createClient.mockResolvedValue({ company: { "audit-events": { $get: get } } })
    mocks.toApiResponseError.mockResolvedValue(expected)

    await expect(getAuditEvents({ limit: "50" })).resolves.toBe(expected)
    expect(mocks.toApiResponseError).toHaveBeenCalledWith(
      response,
      "監査ログを取得できませんでした",
    )
  })
})
