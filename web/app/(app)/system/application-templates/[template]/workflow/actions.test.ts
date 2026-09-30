import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { saveWorkflowAction } from "@/app/(app)/system/application-templates/[template]/workflow/actions"

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  updateApplicationWorkflow: vi.fn(),
}))

vi.mock("@/lib/api/get-me", () => ({
  getMe: mocks.getMe,
}))

vi.mock("@/lib/api/update-application-workflow", () => ({
  updateApplicationWorkflow: mocks.updateApplicationWorkflow,
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const workflow = {
  version: 1,
  steps: [
    {
      key: "manager",
      name: "Manager",
      approvers: [{ type: "direct_manager" }],
      approval_mode: "any",
      condition_mode: "all",
      conditions: [],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "return",
      allow_delegation: true,
    },
  ],
}

beforeEach(() => {
  mocks.getMe.mockReset()
  mocks.getMe.mockResolvedValue({ permissions: ["application_template:manage"] })
  mocks.updateApplicationWorkflow.mockReset()
})

describe("saveWorkflowAction", () => {
  test("retains the loaded revision when permission is denied", async () => {
    mocks.getMe.mockResolvedValue({ permissions: [] })

    const result = await saveWorkflowAction({ ok: false, error: null, revision: 4 }, new FormData())

    expect(result).toEqual({
      ok: false,
      error: "承認フローを管理する権限がありません",
      revision: 4,
    })
  })

  test("keeps the draft revision and explains an optimistic-lock conflict", async () => {
    mocks.updateApplicationWorkflow.mockResolvedValue(
      new ApiResponseError(
        409,
        "workflow definition was updated by another administrator",
        "workflow_revision_conflict",
      ),
    )
    const formData = new FormData()
    formData.set("code", "expense")
    formData.set("workflow_json", JSON.stringify(workflow))
    formData.set("expected_revision", "4")

    const result = await saveWorkflowAction({ ok: false, error: null, revision: 4 }, formData)

    expect(mocks.updateApplicationWorkflow).toHaveBeenCalledWith("expense", workflow, 4)
    expect(result).toEqual({
      ok: false,
      error:
        "他の管理者が先に承認フローを更新しました。画面を再読み込みして変更を確認してください。",
      revision: 4,
    })
  })
})
