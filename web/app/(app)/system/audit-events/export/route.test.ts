import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { GET } from "@/app/(app)/system/audit-events/export/route"

const mocks = vi.hoisted(() => ({ exportAuditEvents: vi.fn() }))
vi.mock("@/lib/api/export-audit-events", () => ({ exportAuditEvents: mocks.exportAuditEvents }))

afterEach(() => vi.clearAllMocks())

const validUrl =
  "https://base.example/admin/audit-events/export?from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A00Z&action=audit.event.read"

describe("audit export Route Handler", () => {
  test.each([
    "?from=2026-01-01T00%3A00%3A00Z",
    "?from=2026-01-01T00%3A00%3A00Z&to=2026-02-01T00%3A00%3A01Z",
    "?from=2026-01-01T00%3A00%3A00Z&from=2026-01-02T00%3A00%3A00Z&to=2026-01-03T00%3A00%3A00Z",
    "?from=2026-01-01T00%3A00%3A00Z&to=2026-01-02T00%3A00%3A00Z&secret=%3Craw%3E",
  ])("rejects invalid local query without contacting or reflecting upstream: %s", async (query) => {
    const response = await GET(new Request(`https://base.example/export${query}`))
    expect(response.status).toBe(400)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.text()).not.toContain("<raw>")
    expect(mocks.exportAuditEvents).not.toHaveBeenCalled()
  })

  test("streams CSV and forwards only the safe header allowlist", async () => {
    mocks.exportAuditEvents.mockResolvedValue(
      new Response("event_id\nfixture\n", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-events.csv"',
          "X-Request-ID": "req-fixture",
          "Set-Cookie": "secret=value",
          "Access-Control-Allow-Origin": "*",
        },
      }),
    )
    const response = await GET(new Request(validUrl))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("event_id\nfixture\n")
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="audit-events.csv"',
    )
    expect(response.headers.get("X-Request-ID")).toBe("req-fixture")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("Set-Cookie")).toBeNull()
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
    expect(mocks.exportAuditEvents).toHaveBeenCalledWith({
      action: "audit.event.read",
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
    })
  })

  test.each([400, 401, 403, 413, 503])(
    "keeps upstream status %s and no-store error body",
    async (status) => {
      mocks.exportAuditEvents.mockResolvedValue(
        new Response('{"error":"safe"}', {
          status,
          headers: { "Content-Type": "application/json", "X-Request-ID": "req-fixture" },
        }),
      )
      const response = await GET(new Request(validUrl))
      expect(response.status).toBe(status)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(response.headers.get("Content-Disposition")).toBeNull()
      expect(response.headers.get("X-Request-ID")).toBe("req-fixture")
      expect(await response.text()).toBe('{"error":"safe"}')
    },
  )
})
