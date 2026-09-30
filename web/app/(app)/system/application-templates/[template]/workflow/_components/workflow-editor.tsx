"use client"
import { companyOrganizationId } from "@/lib/api/company-organization-id"
import { WorkflowStepEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-step-editor"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import {
  saveWorkflowAction,
  type WorkflowFormState,
} from "@/app/(app)/system/application-templates/[template]/workflow/actions"
import { parseWorkflowDefinitionJson } from "@/app/(app)/system/application-templates/[template]/workflow/_lib/workflow-definition"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type {
  ApplicationWorkflow,
  ApplicationWorkflowStep,
} from "@/lib/api/types/application-workflow-types"

const defaultStep = (index: number): ApplicationWorkflowStep => ({
  key: `approval_${index + 1}`,
  name: `承認ステップ ${index + 1}`,
  approvers: [{ type: "direct_manager" }],
  approval_mode: "any",
  condition_mode: "all",
  conditions: [],
  due_days: null,
  escalation_approvers: [],
  rejection_behavior: "return",
  allow_delegation: true,
})

function firstAvailableDefaultStep(steps: ReadonlyArray<ApplicationWorkflowStep>) {
  const usedKeys = new Set(steps.map((step) => step.key))
  let index = 0

  while (usedKeys.has(`approval_${index + 1}`)) index += 1

  return defaultStep(index)
}

export function WorkflowEditor(props: {
  code: string
  saveAction?: typeof saveWorkflowAction
  initial: ApplicationWorkflow
  revision: number
}) {
  const [draft, setDraft] = useState({
    workflow: props.initial,
    json: JSON.stringify(props.initial, null, 2),
    basicEditingAllowed: true,
  })
  const advanced = draft.json
  const definition = parseWorkflowDefinitionJson(advanced)
  const workflow = draft.workflow
  const hasLegacySelectors = workflow.steps.some((step) =>
    [...step.approvers, ...step.escalation_approvers].some(
      (selector) => selector.type === "role" || selector.type === "responsibility",
    ),
  )
  const migrationError = hasLegacySelectors
    ? "旧形式の組織責務・IAMロールが含まれています。「会社の責務でステップを追加」から責務と適用範囲を確認して設定し、旧ステップを削除してください。期限後の承認者指定も詳細設定で見直してください。自動変換は行いません。"
    : null
  const definitionError = definition.success ? null : definition.error
  const [state, action, pending] = useActionState(
    async (previous: WorkflowFormState, data: FormData) => {
      const next = await (props.saveAction ?? saveWorkflowAction)(previous, data)
      if (next.ok) toast.success("承認フローを保存しました")
      else if (next.error !== null) toast.error(next.error)
      return next
    },
    { ok: false, error: null, revision: props.revision },
  )

  function commit(next: ApplicationWorkflow) {
    setDraft({ workflow: next, json: JSON.stringify(next, null, 2), basicEditingAllowed: true })
  }

  function updateStep(index: number, nextStep: ApplicationWorkflowStep) {
    commit({ ...workflow, steps: workflow.steps.map((step, i) => (i === index ? nextStep : step)) })
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={props.code} />
      <input type="hidden" name="workflow_json" value={advanced} />
      <input type="hidden" name="expected_revision" value={state.revision} />

      <FieldSet className="gap-4" disabled={!draft.basicEditingAllowed}>
        <FieldLegend className="sr-only">ワークフロー基本設定</FieldLegend>
        {workflow.steps.map((step, index) => (
          <WorkflowStepEditor
            key={step.key}
            step={step}
            index={index}
            canDelete={workflow.steps.length > 1}
            onChange={(next) => updateStep(index, next)}
            onMoveUp={() => {
              const steps = [...workflow.steps]
              ;[steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]
              commit({ ...workflow, steps })
            }}
            onDelete={() =>
              commit({ ...workflow, steps: workflow.steps.filter((_, i) => i !== index) })
            }
          />
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            commit({
              ...workflow,
              steps: [...workflow.steps, firstAvailableDefaultStep(workflow.steps)],
            })
          }
        >
          ステップを追加
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const step = firstAvailableDefaultStep(workflow.steps)
            commit({
              ...workflow,
              steps: [
                ...workflow.steps,
                {
                  ...step,
                  name: "会社の責務による承認",
                  approvers: [],
                  governance_authority: {
                    organization_id: companyOrganizationId,
                    responsibility_code: "",
                    scope: null,
                  },
                  rejection_behavior: "reject",
                  allow_delegation: false,
                },
              ],
            })
          }}
        >
          会社の責務でステップを追加
        </Button>
      </FieldSet>

      <details className="rounded-lg bg-card border p-4">
        <summary className="cursor-pointer font-medium">
          詳細設定（条件分岐・エスカレーション・JSON）
        </summary>
        <Field className="mt-4" data-invalid={definitionError === null ? undefined : true}>
          <FieldLabel htmlFor="workflow-advanced">ワークフロー定義</FieldLabel>
          <FieldDescription>
            payload／申請者属性の条件、期限後の承認者など全項目を編集できます。
          </FieldDescription>
          <Textarea
            id="workflow-advanced"
            className="min-h-96"
            value={advanced}
            aria-invalid={definitionError !== null}
            onChange={(event) => {
              const json = event.target.value
              const parsed = parseWorkflowDefinitionJson(json)
              setDraft({
                json,
                workflow: parsed.success ? parsed.workflow : workflow,
                basicEditingAllowed: parsed.success,
              })
            }}
          />
          {definitionError === null ? null : <FieldError>{definitionError}</FieldError>}
        </Field>
      </details>

      <div aria-live="polite">
        {migrationError === null ? null : <FieldError>{migrationError}</FieldError>}
        {state.error === null ? null : <FieldError>{state.error}</FieldError>}
      </div>
      <Button
        type="submit"
        disabled={pending || definitionError !== null || migrationError !== null}
      >
        {pending ? "保存中…" : "承認フローを保存"}
      </Button>
    </form>
  )
}
