import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { AuditCursorPagination } from "@/app/(app)/system/audit-events/_components/audit-cursor-pagination"
import type { AuditListQuery } from "@/lib/api/types/audit-types"

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

const query: AuditListQuery = {
  action: "audit.event.read",
  target_id: "id / 一",
  limit: "25",
  cursor: "current",
}

describe("AuditCursorPagination", () => {
  test("preserves filters and renders both opaque cursor links without page numbers", () => {
    render(
      <AuditCursorPagination query={query} previousCursor="opaque-prev" nextCursor="opaque-next" />,
    )

    const navigation = screen.getByRole("navigation", { name: "監査ログのページ送り" })
    const previous = screen.getByRole("button", { name: "前のページ" })
    const next = screen.getByRole("button", { name: "次のページ" })

    expect(navigation).toBeDefined()
    expect(previous.getAttribute("href")).toContain("action=audit.event.read")
    expect(previous.getAttribute("href")).toContain("target_id=id+%2F+%E4%B8%80")
    expect(previous.getAttribute("href")).toContain("cursor=opaque-prev")
    expect(next.getAttribute("href")).toContain("cursor=opaque-next")
    expect(previous.getAttribute("data-prefetch")).toBe("false")
    expect(next.getAttribute("data-prefetch")).toBe("false")
    expect(screen.queryByText(/page|ページ 1|全.*件/iu)).toBeNull()
  })

  test("shows non-interactive disabled text when neither direction exists", () => {
    render(<AuditCursorPagination query={query} previousCursor={null} nextCursor={null} />)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(screen.getByText("前のページ").getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByText("次のページ").getAttribute("aria-disabled")).toBe("true")
  })
})
