import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { AuditEventListSection } from "@/app/(app)/system/audit-events/_components/audit-event-list-section"

const mocks = vi.hoisted(() => ({
  getAuditEvents: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))

vi.mock("@/lib/api/get-audit-events", () => ({ getAuditEvents: mocks.getAuditEvents }))
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const query = { action: "audit.event.read", limit: "50", cursor: "opaque" } as const

describe("AuditEventListSection", () => {
  test("does not expose rows after a live permission-race denial", async () => {
    mocks.getAuditEvents.mockResolvedValue(
      new ApiResponseError(403, "safe", "audit_read_forbidden"),
    )
    await expect(AuditEventListSection({ query })).rejects.toThrow("NOT_FOUND")
    expect(mocks.notFound).toHaveBeenCalledOnce()
  })

  test("offers a cursorless retry for an invalid opaque cursor while preserving filters", async () => {
    mocks.getAuditEvents.mockResolvedValue(
      new ApiResponseError(400, "safe", "invalid_audit_cursor"),
    )
    render(await AuditEventListSection({ query }))
    expect(screen.getByText("ページ情報が無効です")).toBeDefined()
    const retry = screen.getByRole("link", { name: "先頭から表示" })
    expect(retry.getAttribute("href")).toContain("action=audit.event.read")
    expect(retry.getAttribute("href")).not.toContain("cursor=")
  })

  test("does not render partial data for other failures", async () => {
    mocks.getAuditEvents.mockResolvedValue(new ApiResponseError(503, "raw upstream body"))
    render(await AuditEventListSection({ query }))
    expect(screen.getByText("監査ログを取得できませんでした")).toBeDefined()
    expect(screen.queryByText("raw upstream body")).toBeNull()
  })
})
