import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { WorkflowEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-editor"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

vi.mock("@/app/(app)/system/application-templates/[template]/workflow/actions", () => ({
  saveWorkflowAction: vi.fn(async () => ({ ok: false, error: null })),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const initialWorkflow: ApplicationWorkflow = {
  version: 1,
  steps: [
    {
      key: "approval_1",
      name: "承認ステップ 1",
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

afterEach(cleanup)

describe("WorkflowEditor", () => {
  test("preserves advanced-only fields when a visual field changes", () => {
    const advancedWorkflow: ApplicationWorkflow = {
      ...initialWorkflow,
      steps: [
        {
          ...initialWorkflow.steps[0],
          conditions: [
            {
              source: "payload",
              field: "amount",
              operator: "gte",
              value: 10_000,
            },
          ],
          escalation_approvers: [{ type: "role", role_key: "root" }],
        },
      ],
    }
    const { container } = render(
      <WorkflowEditor code="expense" initial={initialWorkflow} revision={7} />,
    )

    fireEvent.change(screen.getByLabelText("ワークフロー定義"), {
      target: { value: JSON.stringify(advancedWorkflow, null, 2) },
    })
    fireEvent.change(screen.getByDisplayValue("承認ステップ 1"), {
      target: { value: "金額別承認" },
    })

    const workflowInput = container.querySelector<HTMLInputElement>('input[name="workflow_json"]')
    if (workflowInput === null) throw new Error("workflow_json input not found")
    const submitted = JSON.parse(workflowInput.value) as ApplicationWorkflow

    expect(submitted.steps[0]?.name).toBe("金額別承認")
    expect(submitted.steps[0]?.conditions).toEqual(advancedWorkflow.steps[0]?.conditions)
    expect(submitted.steps[0]?.escalation_approvers).toEqual(
      advancedWorkflow.steps[0]?.escalation_approvers,
    )
  })

  test("keeps an invalid workflow JSON draft while disabling visual editing and save", () => {
    render(<WorkflowEditor code="expense" initial={initialWorkflow} revision={7} />)
    const definition = screen.getByLabelText("ワークフロー定義")

    fireEvent.change(definition, { target: { value: '{"version":1,"steps":[]}' } })

    const visualEditor = screen.getByRole("group", { name: "ワークフロー基本設定" })
    const saveButton = screen.getByRole("button", { name: "承認フローを保存" })
    const definitionField = definition.closest('[data-slot="field"]')

    expect((definition as HTMLTextAreaElement).value).toBe('{"version":1,"steps":[]}')
    expect(definitionField?.getAttribute("data-invalid")).toBe("true")
    expect(definition.getAttribute("aria-invalid")).toBe("true")
    expect((visualEditor as HTMLFieldSetElement).disabled).toBe(true)
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole("alert").textContent).toContain("ワークフロー定義")
  })

  test("submits the loaded revision and exposes stable labels and a live error region", () => {
    const minimumWorkflow: ApplicationWorkflow = {
      ...initialWorkflow,
      steps: [
        {
          ...initialWorkflow.steps[0],
          approval_mode: "minimum",
          minimum_approvals: 1,
        },
      ],
    }
    const { container } = render(
      <WorkflowEditor code="expense" initial={minimumWorkflow} revision={7} />,
    )

    const revisionInput = container.querySelector<HTMLInputElement>(
      'input[name="expected_revision"]',
    )
    expect(revisionInput?.value).toBe("7")
    expect(screen.getByLabelText("表示名").id).toBe("workflow-step-0-name")
    expect(screen.getByLabelText("ステップキー").id).toBe("workflow-step-0-key")
    expect(screen.getByLabelText("完了条件").id).toBe("workflow-step-0-approval-mode")
    expect(screen.getByLabelText("必要人数").id).toBe("workflow-step-0-minimum-approvals")
    expect(screen.getByLabelText("期限（日）").id).toBe("workflow-step-0-due-days")
    expect(screen.getByLabelText("否認時").id).toBe("workflow-step-0-rejection-behavior")
    expect(screen.getByLabelText("ステップ 1 承認者 1 の種類")).toBeDefined()
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
  })

  test("reuses the first available approval key after a step is deleted", () => {
    const threeStepWorkflow: ApplicationWorkflow = {
      ...initialWorkflow,
      steps: [1, 2, 3].map((number) => ({
        ...initialWorkflow.steps[0],
        key: `approval_${number}`,
        name: `承認ステップ ${number}`,
      })),
    }
    const { container } = render(
      <WorkflowEditor code="expense" initial={threeStepWorkflow} revision={7} />,
    )

    const stepDeleteButtons = screen
      .getAllByRole<HTMLButtonElement>("button", { name: "削除" })
      .filter((button) => button.disabled === false)
    fireEvent.click(stepDeleteButtons[1]!)
    fireEvent.click(screen.getByRole("button", { name: "ステップを追加" }))

    const workflowInput = container.querySelector<HTMLInputElement>('input[name="workflow_json"]')
    if (workflowInput === null) throw new Error("workflow_json input not found")
    const submitted = JSON.parse(workflowInput.value) as ApplicationWorkflow
    expect(submitted.steps.map((step) => step.key)).toEqual([
      "approval_1",
      "approval_3",
      "approval_2",
    ])
    expect(new Set(submitted.steps.map((step) => step.key)).size).toBe(submitted.steps.length)
  })

  test("保存済みの旧責務と範囲を自動変換せず表示する", () => {
    const responsibilityWorkflow: ApplicationWorkflow = {
      ...initialWorkflow,
      steps: [
        {
          ...initialWorkflow.steps[0],
          approvers: [
            {
              type: "responsibility",
              responsibility_type: "PEOPLE_OPERATIONS",
              organization_unit_code: null,
            },
          ],
        },
      ],
    }
    const { container } = render(
      <WorkflowEditor code="personnel" initial={responsibilityWorkflow} revision={3} />,
    )

    expect(screen.getByText("責務: PEOPLE_OPERATIONS / 組織: 全組織")).toBeDefined()
    expect(screen.queryByLabelText("責務タイプ")).toBeNull()
    expect(
      (screen.getByRole("button", { name: "承認フローを保存" }) as HTMLButtonElement).disabled,
    ).toBe(true)

    const workflowInput = container.querySelector<HTMLInputElement>('input[name="workflow_json"]')
    if (workflowInput === null) throw new Error("workflow_json input not found")
    const submitted = JSON.parse(workflowInput.value) as ApplicationWorkflow
    expect(submitted.steps[0]?.approvers).toEqual([
      {
        type: "responsibility",
        responsibility_type: "PEOPLE_OPERATIONS",
        organization_unit_code: null,
      },
    ])
  })
})

test("公開責務の条件を編集し、会社が決める人数を上書きしない", () => {
  const initial: ApplicationWorkflow = {
    ...initialWorkflow,
    steps: [
      {
        ...initialWorkflow.steps[0],
        approvers: [],
        governance_authority: {
          organization_id: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
          responsibility_code: "REVIEWER",
          scope: null,
        },
      },
    ],
  }
  const rendered = render(<WorkflowEditor code="review" initial={initial} revision={1} />)
  expect(screen.queryByLabelText("完了条件")).toBeNull()
  expect(screen.queryByRole("button", { name: "承認者を追加" })).toBeNull()
  fireEvent.change(screen.getByLabelText("会社の責務コード"), { target: { value: "" } })
  expect(screen.getByLabelText("会社の責務コード").closest("fieldset")?.disabled).toBe(false)
  fireEvent.change(screen.getByLabelText("会社の責務コード"), { target: { value: "BOARD_REVIEW" } })
  fireEvent.change(screen.getByLabelText("責務の適用範囲"), { target: { value: "amount" } })
  fireEvent.change(screen.getByLabelText("通貨コード"), { target: { value: "JPY" } })
  fireEvent.change(screen.getByLabelText("申請内の金額項目"), { target: { value: "amount" } })
  const field = rendered.container.querySelector<HTMLInputElement>('input[name="workflow_json"]')
  if (field === null) throw new Error("workflow field missing")
  expect(JSON.parse(field.value)).toMatchObject({
    steps: [
      {
        approvers: [],
        governance_authority: {
          responsibility_code: "BOARD_REVIEW",
          scope: { scope_type: "amount", currency_code: "JPY", amount_field: "amount" },
        },
        approval_mode: "any",
      },
    ],
  })
})

test("空欄から公開責務のステップを追加して入力を完了できる", () => {
  const rendered = render(<WorkflowEditor code="review" initial={initialWorkflow} revision={1} />)
  fireEvent.click(screen.getByRole("button", { name: "会社の責務でステップを追加" }))
  fireEvent.change(screen.getByLabelText("会社の責務コード"), { target: { value: "REVIEWER" } })
  fireEvent.change(screen.getByLabelText("責務の適用範囲"), {
    target: { value: "organization-unit" },
  })
  fireEvent.change(screen.getByLabelText("適用先ID"), { target: { value: "unit:review" } })
  const field = rendered.container.querySelector<HTMLInputElement>('input[name="workflow_json"]')
  if (field === null) throw new Error("workflow field missing")
  expect(JSON.parse(field.value)).toMatchObject({
    steps: [
      initialWorkflow.steps[0],
      {
        governance_authority: {
          responsibility_code: "REVIEWER",
          scope: { scope_type: "organization-unit", scope_id: "unit:review" },
        },
        allow_delegation: false,
        rejection_behavior: "reject",
        approvers: [],
      },
    ],
  })
})

test.each(["approvers", "escalation_approvers"])("旧責務を表示して保存を止める: %s", (field) => {
  const workflow: ApplicationWorkflow = {
    ...initialWorkflow,
    steps: [
      {
        ...initialWorkflow.steps[0],
        [field]: [
          { type: "responsibility", responsibility_type: "REVIEWER", organization_unit_code: null },
        ],
      },
    ],
  }
  render(<WorkflowEditor code="review" initial={workflow} revision={2} />)
  expect(
    (screen.getByRole("button", { name: "承認フローを保存" }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(screen.getByRole("alert").textContent).toContain("適用範囲を確認")
  expect(screen.queryByRole("option", { name: "IAMロール" })).toBeNull()
  expect(screen.queryByRole("option", { name: "組織責務" })).toBeNull()
  fireEvent.change(screen.getByLabelText("ワークフロー定義"), {
    target: { value: JSON.stringify(initialWorkflow) },
  })
  expect(
    (screen.getByRole("button", { name: "承認フローを保存" }) as HTMLButtonElement).disabled,
  ).toBe(false)
})
