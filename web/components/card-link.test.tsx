import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vite-plus/test"
import { CardLink } from "@/components/card-link"

describe("CardLink", () => {
  test("カード全体を 1 つのリンクにする", () => {
    render(<CardLink href="/meeting/meetings/abc">定例会</CardLink>)

    const link = screen.getByRole("link", { name: "定例会" })

    expect(link.getAttribute("href")).toBe("/meeting/meetings/abc")
  })

  test("押せることを示す ChevronRight を右下に描画する", () => {
    const { container } = render(<CardLink href="/inbox">受信箱</CardLink>)

    const icon = container.querySelector("svg")

    expect(icon).not.toBeNull()
    expect(icon?.getAttribute("class")).toContain("absolute")
    expect(icon?.getAttribute("class")).toContain("right-3")
    expect(icon?.getAttribute("class")).toContain("bottom-3")
  })

  test("ChevronRight は読み上げ対象にしない", () => {
    const { container } = render(<CardLink href="/inbox">受信箱</CardLink>)

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  })

  test("監査導線のために prefetch を渡せる", () => {
    render(
      <CardLink href="/system/audit-events" prefetch={false}>
        監査ログ
      </CardLink>,
    )

    expect(screen.getByRole("link", { name: "監査ログ" })).toBeDefined()
  })
})
