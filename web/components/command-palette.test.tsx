import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { CommandPalette } from "@/components/command-palette"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

const inboxCounts = { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("CommandPalette audit entry", () => {
  test("shows the audit command only with audit:read and navigates once on explicit selection", () => {
    render(<CommandPalette inboxCounts={inboxCounts} permissions={["audit:read"]} />)
    openPalette()

    const command = screen.getByText("監査ログ")
    expect(command).toBeTruthy()
    fireEvent.click(command)
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/system/audit-events")
  })

  test("does not expose the audit command to export-only users", () => {
    render(<CommandPalette inboxCounts={inboxCounts} permissions={["audit:export"]} />)
    openPalette()

    expect(screen.queryByText("監査ログ")).toBeNull()
  })
})

test("does not expose removed business commands", () => {
  render(
    <CommandPalette
      inboxCounts={inboxCounts}
      permissions={["governance:read", "expense:read:all"]}
    />,
  )
  openPalette()
  expect(screen.queryByText("規程・手続き")).toBeNull()
  expect(screen.queryByText("経費申請")).toBeNull()
})

function openPalette(): void {
  fireEvent.keyDown(document, { key: "k", ctrlKey: true })
}
