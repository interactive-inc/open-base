import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { AuthError } from "@/lib/api/auth-error"
import type { AuditEventDetail } from "@/lib/api/types/audit-types"
import AuditEventDetailPage from "@/app/(app)/system/audit-events/[event]/page"

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getAuditEvent: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))

vi.mock("@/lib/auth/require-permission", () => ({ requirePermission: mocks.requirePermission }))
vi.mock("@/lib/api/get-audit-event", () => ({ getAuditEvent: mocks.getAuditEvent }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}))
vi.mock("@/components/back-button", () => ({
  BackButton: ({ href, label, prefetch }: { href: string; label: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)}>
      {label}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const detail: AuditEventDetail = {
  event_id: "evt-001",
  request_id: "req-001",
  actor_account_id: "account-10",
  actor_employee_id: "20",
  action: "audit.event.read",
  target_type: "audit_event",
  target_id: "evt-000",
  outcome: "succeeded",
  reason_code: null,
  client_name: "web",
  created_at: "2026-07-14T01:02:03.000Z",
  client_ip: "192.0.2.1",
  authorization_json: '{"permission":"audit:read"}',
  before_json: null,
  after_json: '{"status":"read"}',
  metadata_json: '{"source":"test"}',
}

describe("AuditEventDetailPage", () => {
  test("checks live read permission before resolving the event identifier", async () => {
    const denied = new Error("NOT_FOUND")
    mocks.requirePermission.mockRejectedValue(denied)
    let paramsRead = false
    const value = Object.defineProperty({}, "event", {
      enumerable: true,
      get() {
        paramsRead = true
        return "evt-001"
      },
    })
    const params = Promise.resolve(value as { event: string })

    await expect(AuditEventDetailPage({ params })).rejects.toBe(denied)
    expect(paramsRead).toBe(false)
    expect(mocks.getAuditEvent).not.toHaveBeenCalled()
  })

  test("shows forensic fields only on detail with four initially collapsed JSON sections", async () => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    mocks.getAuditEvent.mockResolvedValue(detail)
    render(await AuditEventDetailPage({ params: Promise.resolve({ event: "evt-001" }) }))

    expect(screen.getByText("192.0.2.1")).toBeDefined()
    for (const label of ["認可情報", "変更前", "変更後", "メタデータ"]) {
      expect(screen.getByRole("button", { name: label }).getAttribute("aria-expanded")).toBe(
        "false",
      )
    }
    fireEvent.click(screen.getByRole("button", { name: "変更前" }))
    expect(screen.getByText("null")).toBeDefined()
    expect(screen.queryByText(/example\.com/u)).toBeNull()
    const back = screen.getByRole("link", { name: "一覧に戻る" })
    expect(back.getAttribute("data-prefetch")).toBe("false")
  })

  test.each([403, 404])("hides event existence for API status %s", async (status) => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    mocks.getAuditEvent.mockResolvedValue(new ApiResponseError(status, "safe"))
    await expect(
      AuditEventDetailPage({ params: Promise.resolve({ event: "evt-001" }) }),
    ).rejects.toThrow("NOT_FOUND")
  })

  test("turns an expired API session into the shared auth boundary", async () => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    mocks.getAuditEvent.mockResolvedValue(new ApiResponseError(401, "safe"))
    await expect(
      AuditEventDetailPage({ params: Promise.resolve({ event: "evt-001" }) }),
    ).rejects.toBeInstanceOf(AuthError)
  })

  test("shows a safe error without reflecting upstream details", async () => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    mocks.getAuditEvent.mockResolvedValue(new ApiResponseError(503, "SQL raw body"))
    render(await AuditEventDetailPage({ params: Promise.resolve({ event: "evt-001" }) }))
    expect(screen.getByText("監査イベントを取得できませんでした")).toBeDefined()
    expect(screen.queryByText(/SQL raw body/u)).toBeNull()
  })
})
