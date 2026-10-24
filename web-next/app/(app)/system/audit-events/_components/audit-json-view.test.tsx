import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vite-plus/test"
import { AuditJsonView } from "@/app/(app)/system/audit-events/_components/audit-json-view"

afterEach(cleanup)

describe("AuditJsonView", () => {
  test("is initially collapsed and renders null explicitly", () => {
    render(<AuditJsonView label="変更前" value={null} />)
    const trigger = screen.getByRole("button", { name: "変更前" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(trigger)
    expect(screen.getByText("null")).toBeDefined()
  })

  test("pretty-prints valid JSON and escapes HTML-looking values", () => {
    const { container } = render(
      <AuditJsonView label="メタデータ" value={'{"value":"<img src=x onerror=alert(1)>"}'} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "メタデータ" }))
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/u)).toBeDefined()
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("pre")?.textContent).toContain('\n  "value"')
  })

  test("falls back to raw text for malformed stored JSON without adding secret or copy controls", () => {
    render(<AuditJsonView label="認可情報" value="<script>not-json</script>" />)
    fireEvent.click(screen.getByRole("button", { name: "認可情報" }))
    expect(screen.getByText("<script>not-json</script>")).toBeDefined()
    expect(screen.queryByRole("button", { name: /secret|copy|コピー|すべて/u })).toBeNull()
  })
})
