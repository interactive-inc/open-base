import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { getAuditEvent } from "@/lib/api/get-audit-event"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  toApiResponseError: vi.fn(),
}))

vi.mock("@/lib/api/hc-client", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/api/to-api-response-error", () => ({
  toApiResponseError: mocks.toApiResponseError,
}))

afterEach(() => vi.clearAllMocks())

describe("getAuditEvent", () => {
  test("passes the event id with no-store and returns forensic strings unchanged", async () => {
    const detail = {
      event_id: "12345678-1234-4abc-8def-1234567890ab",
      request_id: "request-1",
      actor_account_id: null,
      actor_employee_id: null,
      action: "custom.action",
      target_type: "custom_target",
      target_id: "target-1",
      outcome: "failed" as const,
      reason_code: "custom_reason",
      client_name: "cli" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      authorization_json: '{"permission":true}',
      before_json: null,
      after_json: "<script>alert(1)</script>",
      metadata_json: "7",
      client_ip: "192.0.2.1",
    }
    const json = vi.fn().mockResolvedValue(detail)
    const get = vi.fn().mockResolvedValue({ ok: true, status: 200, json })
    mocks.createClient.mockResolvedValue({
      company: { "audit-events": { ":eventId": { $get: get } } },
    })

    await expect(getAuditEvent("12345678-1234-4abc-8def-1234567890ab")).resolves.toEqual(detail)
    expect(get).toHaveBeenCalledWith(
      { param: { eventId: "12345678-1234-4abc-8def-1234567890ab" } },
      { init: { cache: "no-store" } },
    )
  })

  test("returns a structured API error for safe page routing", async () => {
    const response = { ok: false, status: 404, json: vi.fn() }
    const expected = new ApiResponseError(404, "safe", "audit_event_not_found")
    const get = vi.fn().mockResolvedValue(response)
    mocks.createClient.mockResolvedValue({
      company: { "audit-events": { ":eventId": { $get: get } } },
    })
    mocks.toApiResponseError.mockResolvedValue(expected)

    await expect(getAuditEvent("42345678-1234-4abc-8def-1234567890ab")).resolves.toBe(expected)
    expect(mocks.toApiResponseError).toHaveBeenCalledWith(
      response,
      "監査イベントを取得できませんでした",
    )
  })
})
