import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AuditEventTable } from "@/app/(app)/system/audit-events/_components/audit-event-table"
import type { AuditEventSummary } from "@/lib/api/types/audit-types"

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

const baseEvent: AuditEventSummary = {
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
}

describe("AuditEventTable", () => {
  test("renders stable actor identifiers for every null combination without identity enrichment", () => {
    render(
      <AuditEventTable
        events={[
          baseEvent,
          { ...baseEvent, event_id: "evt-002", actor_account_id: null },
          { ...baseEvent, event_id: "evt-003", actor_employee_id: null },
          {
            ...baseEvent,
            event_id: "evt-004",
            actor_account_id: null,
            actor_employee_id: null,
          },
        ]}
      />,
    )

    const rows = screen.getAllByRole("row").slice(1)
    expect(within(rows[0]).getByText("account:account-10 / employee:20")).toBeDefined()
    expect(within(rows[1]).getByText("account:— / employee:20")).toBeDefined()
    expect(within(rows[2]).getByText("account:account-10 / employee:—")).toBeDefined()
    expect(within(rows[3]).getByText("未認証")).toBeDefined()
    expect(screen.queryByText(/example\.com/u)).toBeNull()
  })

  test("shows unknown vocabulary as text and creates an explicit no-prefetch detail link", () => {
    render(
      <AuditEventTable
        events={[
          {
            ...baseEvent,
            action: "custom.action.<script>",
            target_type: "custom_target",
            reason_code: "custom_reason",
          },
        ]}
      />,
    )

    expect(screen.getByText("custom.action.<script>")).toBeDefined()
    expect(screen.getByText("custom_target")).toBeDefined()
    expect(screen.getByText("custom_reason")).toBeDefined()
    expect(screen.getByText(/10:02:03/u)).toBeDefined()

    const link = screen.getByRole("button", { name: "監査イベント evt-001 の詳細" })
    expect(link.getAttribute("href")).toBe("/system/audit-events/evt-001")
    expect(link.getAttribute("data-prefetch")).toBe("false")
  })

  test("uses the shared empty composition when there are no rows", () => {
    const { container } = render(<AuditEventTable events={[]} />)
    expect(screen.getByText("該当する監査ログはありません")).toBeDefined()
    expect(container.querySelector('[data-slot="empty"]')).not.toBeNull()
  })
})
