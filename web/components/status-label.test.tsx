import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vite-plus/test"
import { StatusLabel } from "@/components/status-label"
import { buttonVariants } from "@/components/ui/button"

describe("StatusLabel", () => {
  test("ボタンとして支援技術へ伝わらない", () => {
    render(<StatusLabel>承認待ち</StatusLabel>)

    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.getByText("承認待ち").tagName).toBe("SPAN")
  })

  test("フォーカスを受けない", () => {
    render(<StatusLabel>承認済み</StatusLabel>)

    const label = screen.getByText("承認済み")

    expect(label.hasAttribute("tabindex")).toBe(false)
    // tabindex の無い span はタブ順に入らない
    expect(label.tabIndex).toBe(-1)
  })

  test("Button の sm サイズと同じ高さのクラスを持つ", () => {
    render(<StatusLabel>下書き</StatusLabel>)

    const classes = screen.getByText("下書き").className.split(" ")

    expect(classes).toContain("h-8")
    expect(buttonVariants({ variant: "secondary", size: "sm" }).split(" ")).toContain("h-8")
  })

  test("既定は secondary で、variant に応じた配色を使う", () => {
    render(
      <>
        <StatusLabel>中立</StatusLabel>
        <StatusLabel variant="destructive">却下</StatusLabel>
      </>,
    )

    expect(screen.getByText("中立").className).toContain("bg-secondary")
    expect(screen.getByText("却下").className).toContain("bg-destructive/10")
  })

  test("size に default を渡すと Button の default と同じ高さになる", () => {
    render(<StatusLabel size="default">確認済み</StatusLabel>)

    expect(screen.getByText("確認済み").className.split(" ")).toContain("h-9")
  })

  test("hover と押下の変化を出さない", () => {
    render(<StatusLabel>有効</StatusLabel>)

    expect(screen.getByText("有効").className).toContain("pointer-events-none")
  })
})
