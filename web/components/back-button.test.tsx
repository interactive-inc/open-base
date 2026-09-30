import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { BackButton } from "@/components/back-button"

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a data-prefetch={prefetch === undefined ? "undefined" : String(prefetch)} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe("BackButton", () => {
  test("preserves the existing Link prefetch default", () => {
    render(<BackButton href="/company/employees" label="一覧へ戻る" />)

    expect(screen.getByRole("button", { name: "一覧へ戻る" }).getAttribute("data-prefetch")).toBe(
      "undefined",
    )
  })

  test("passes explicit prefetch false and marks its icon decorative", () => {
    render(<BackButton href="/system/audit-events" label="監査ログへ戻る" prefetch={false} />)

    const link = screen.getByRole("button", { name: "監査ログへ戻る" })
    expect(link.getAttribute("data-prefetch")).toBe("false")
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  })
})
