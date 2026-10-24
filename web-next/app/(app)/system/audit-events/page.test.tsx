import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import AuditEventsPage from "@/app/(app)/system/audit-events/page"

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}))

vi.mock("@/lib/auth/require-permission", () => ({
  requirePermission: mocks.requirePermission,
}))
vi.mock("@/app/(app)/system/audit-events/_components/audit-export-form", () => ({
  AuditExportForm: () => <div>CSV出力フォーム</div>,
}))
vi.mock("@/app/(app)/system/audit-events/_components/audit-event-list-section", () => ({
  AuditEventListSection: () => <div>監査ログ一覧</div>,
}))
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("AuditEventsPage", () => {
  test("gates the page with audit:read and shows export only with audit:export", async () => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read", "audit:export"] })
    render(await AuditEventsPage({ searchParams: Promise.resolve({}) }))
    expect(mocks.requirePermission).toHaveBeenCalledWith("audit:read")
    expect(screen.getByText("CSV出力フォーム")).toBeDefined()

    cleanup()
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    render(await AuditEventsPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByText("CSV出力フォーム")).toBeNull()
  })

  test("rejects an invalid query without reflecting raw input", async () => {
    mocks.requirePermission.mockResolvedValue({ permissions: ["audit:read"] })
    render(
      await AuditEventsPage({
        searchParams: Promise.resolve({ unexpected: "<script>secret</script>" }),
      }),
    )
    expect(screen.getByText("検索条件が無効です")).toBeDefined()
    expect(screen.queryByText(/secret/u)).toBeNull()
    expect(screen.queryByText("監査ログ一覧")).toBeNull()
  })

  test("does not inspect query state after the permission gate rejects", async () => {
    const denied = new Error("NOT_FOUND")
    mocks.requirePermission.mockRejectedValue(denied)
    let queryRead = false
    const query = Object.defineProperty({}, "action", {
      enumerable: true,
      get() {
        queryRead = true
        return "audit.event.read"
      },
    })
    const searchParams = Promise.resolve(query as Record<string, string>)

    await expect(AuditEventsPage({ searchParams })).rejects.toBe(denied)
    expect(queryRead).toBe(false)
  })
})
