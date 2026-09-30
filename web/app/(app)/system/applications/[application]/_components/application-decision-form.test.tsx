import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { cleanup, render, screen } from "@testing-library/react"
import { ApplicationDecisionForm } from "@/app/(app)/system/applications/[application]/_components/application-decision-form"

vi.mock("@/app/(app)/system/applications/[application]/actions", () => ({
  decideApplicationAction: vi.fn(async () => ({ ok: false, error: null })),
}))
afterEach(cleanup)

describe("表示した判断対象を送るフォーム", () => {
  test("表示時の提案版・digest・段階・roundをフォームへ固定する", () => {
    const target = {
      proposal_version: 2,
      proposal_digest: "a".repeat(64),
      task_key: "review",
      task_round: 3,
    }
    const rendered = render(
      <ApplicationDecisionForm
        applicationId={42}
        decisionTarget={target}
        negativeAction="reject"
      />,
    )
    const element = rendered.container.querySelector("form")
    if (element === null) throw new Error("decision form is missing")
    const body = new FormData(element)
    expect(body.get("application_id")).toBe("42")
    for (const [key, value] of Object.entries(target)) expect(body.get(key)).toBe(String(value))
    expect(screen.getByRole("button", { name: "承認" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "却下" })).toBeTruthy()
  })
  test("差戻しの手順を却下と表示しない", () => {
    render(
      <ApplicationDecisionForm
        applicationId={42}
        decisionTarget={{
          proposal_version: 2,
          proposal_digest: "a".repeat(64),
          task_key: "review",
          task_round: 3,
        }}
        negativeAction="return"
      />,
    )
    expect(screen.getByRole("button", { name: "差戻し" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "却下" })).toBeNull()
  })
})
