import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AuditEventFilterForm } from "@/app/(app)/system/audit-events/_components/audit-event-filter-form"

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe("AuditEventFilterForm", () => {
  test("uses explicit labels, preserves normalized filters, and never submits the cursor", () => {
    const { container } = render(
      <AuditEventFilterForm
        query={{
          actor_account_id: "12",
          action: "audit.event.read",
          target_type: "audit_event",
          target_id: "evt-001",
          outcome: "denied",
          from: "2026-07-01T00:00:00+09:00",
          to: "2026-07-02T00:00:00+09:00",
          limit: "25",
          cursor: "opaque-cursor",
        }}
      />,
    )

    expect(screen.getByLabelText("実行アカウントID").getAttribute("name")).toBe("actor_account_id")
    expect(screen.getByLabelText("操作").getAttribute("value")).toBe("audit.event.read")
    expect((screen.getByLabelText("結果") as HTMLSelectElement).value).toBe("denied")
    expect(screen.getByText(/2026-07-01T00:00:00\+09:00/u)).toBeDefined()
    expect(container.querySelector('[name="cursor"]')).toBeNull()

    const reset = screen.getByRole("button", { name: "条件をリセット" })
    expect(reset.getAttribute("href")).toBe("/system/audit-events")
    expect(reset.getAttribute("data-prefetch")).toBe("false")
  })
})
