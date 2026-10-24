import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vite-plus/test"
import { TextLink } from "@/components/text-link"

describe("TextLink", () => {
  test("文言をリンクにする", () => {
    render(<TextLink href="/my/attendances">勤怠を開く</TextLink>)

    const link = screen.getByRole("link", { name: "勤怠を開く" })

    expect(link.getAttribute("href")).toBe("/my/attendances")
  })

  test("文末に ChevronRight を描画する", () => {
    const { container } = render(<TextLink href="/my/leaves">休暇を開く</TextLink>)

    const link = container.querySelector("a")
    const icon = container.querySelector("svg")

    expect(icon).not.toBeNull()
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
    // 文字 → アイコンの順に並ぶこと
    expect(link?.lastElementChild).toBe(icon)
  })

  test("下線は文字だけに掛け、アイコンには掛けない", () => {
    const { container } = render(<TextLink href="/my/applications">申請を開く</TextLink>)

    const label = container.querySelector("span")

    expect(label?.textContent).toBe("申請を開く")
    expect(label?.getAttribute("class")).toContain("group-hover/text-link:underline")
    expect(container.querySelector("a")?.getAttribute("class")).not.toContain("hover:underline")
  })
})
