import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { WorkflowRepairList } from "@/app/(app)/system/workflow-repairs/_components/workflow-repair-list"

vi.mock("@/app/(app)/system/workflow-repairs/actions", () => ({
  reassignWorkflowStepAction: vi.fn(async () => ({ ok: false, error: null })),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

afterEach(cleanup)

describe("WorkflowRepairList", () => {
  test("renders repair evidence and a reasoned candidate reassignment form", () => {
    render(
      <WorkflowRepairList
        repairs={[
          {
            id: 42,
            template_code: "purchase",
            template_name: "Purchase request",
            applicant_name: "Example User",
            step_key: "manager_approval",
            round: 2,
            reason: "inactive_candidates",
            started_at: "2026-07-14T00:00:00.000Z",
          },
        ]}
      />,
    )

    expect(screen.getByText("Purchase request")).toBeTruthy()
    expect(screen.getByText("候補者が無効または不足")).toBeTruthy()
    expect(screen.getByLabelText("候補従業員 ID")).toBeTruthy()
    expect(screen.queryByLabelText("必要承認数（全員承認の場合）")).toBeNull()
    expect(screen.getByLabelText("再割当理由")).toBeTruthy()
    expect(screen.getByRole("button", { name: "候補者を再割当" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "候補者を再割当" }))
    expect(screen.getByText("承認候補者を再割当しますか？")).toBeTruthy()
    expect(screen.getByRole("button", { name: "再割当を確定" })).toBeTruthy()
  })

  test("renders an audited quorum confirmation for a missing snapshot", () => {
    render(
      <WorkflowRepairList
        repairs={[
          {
            id: 43,
            template_code: "purchase",
            template_name: "Purchase request",
            applicant_name: "Example User",
            step_key: "manager_approval",
            round: 1,
            reason: "snapshot_missing",
            started_at: "2026-07-14T00:00:00.000Z",
          },
        ]}
      />,
    )

    expect(screen.getByLabelText("必要承認数（全員承認の場合）")).toBeTruthy()
    expect(screen.getByText(/この上書きは監査イベントに記録/)).toBeTruthy()
  })
})
