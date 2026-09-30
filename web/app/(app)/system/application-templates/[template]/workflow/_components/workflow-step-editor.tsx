"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import type { ApplicationWorkflowStep } from "@/lib/api/types/application-workflow-types"
import { GovernanceAuthorityEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/governance-authority-editor"
import { ApproverRow } from "@/app/(app)/system/application-templates/[template]/workflow/_components/approver-row"

type Props = {
  step: ApplicationWorkflowStep
  index: number
  canDelete: boolean
  onChange: (step: ApplicationWorkflowStep) => void
  onDelete: () => void
  onMoveUp: () => void
}
/** 承認ステップの条件を編集する。 */
export function WorkflowStepEditor(props: Props) {
  const step = props.step
  const index = props.index
  return (
    <Card key={step.key}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>ステップ {index + 1}</CardTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={index === 0}
            onClick={props.onMoveUp}
          >
            上へ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!props.canDelete}
            onClick={props.onDelete}
          >
            削除
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`workflow-step-${index}-name`}>表示名</FieldLabel>
          <Input
            id={`workflow-step-${index}-name`}
            value={step.name}
            onChange={(event) => props.onChange({ ...step, name: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`workflow-step-${index}-key`}>ステップキー</FieldLabel>
          <Input
            id={`workflow-step-${index}-key`}
            value={step.key}
            pattern="[A-Za-z0-9_-]+"
            onChange={(event) => props.onChange({ ...step, key: event.target.value })}
          />
        </Field>
        {step.governance_authority === undefined ? (
          <>
            <Field>
              <FieldLabel htmlFor={`workflow-step-${index}-approval-mode`}>完了条件</FieldLabel>
              <NativeSelect
                id={`workflow-step-${index}-approval-mode`}
                value={step.approval_mode}
                onChange={(event) =>
                  props.onChange({
                    ...step,
                    approval_mode: event.target.value as ApplicationWorkflowStep["approval_mode"],
                  })
                }
              >
                <NativeSelectOption value="any">いずれか1人</NativeSelectOption>
                <NativeSelectOption value="all">全員</NativeSelectOption>
                <NativeSelectOption value="minimum">指定人数</NativeSelectOption>
              </NativeSelect>
            </Field>
            {step.approval_mode === "minimum" ? (
              <Field>
                <FieldLabel htmlFor={`workflow-step-${index}-minimum-approvals`}>
                  必要人数
                </FieldLabel>
                <Input
                  id={`workflow-step-${index}-minimum-approvals`}
                  type="number"
                  min={1}
                  max={100}
                  value={step.minimum_approvals ?? 1}
                  onChange={(event) =>
                    props.onChange({
                      ...step,
                      minimum_approvals: Number(event.target.value),
                    })
                  }
                />
              </Field>
            ) : null}
          </>
        ) : (
          <GovernanceAuthorityEditor
            index={index}
            authority={step.governance_authority}
            onChange={(authority) => props.onChange({ ...step, governance_authority: authority })}
          />
        )}
        <Field>
          <FieldLabel htmlFor={`workflow-step-${index}-due-days`}>期限（日）</FieldLabel>
          <Input
            id={`workflow-step-${index}-due-days`}
            type="number"
            min={0}
            max={365}
            value={step.due_days ?? ""}
            placeholder="期限なし"
            onChange={(event) =>
              props.onChange({
                ...step,
                due_days: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`workflow-step-${index}-rejection-behavior`}>否認時</FieldLabel>
          <NativeSelect
            id={`workflow-step-${index}-rejection-behavior`}
            value={step.rejection_behavior}
            onChange={(event) =>
              props.onChange({
                ...step,
                rejection_behavior: event.target.value as "reject" | "return",
              })
            }
          >
            <NativeSelectOption value="return">申請者へ差戻し</NativeSelectOption>
            <NativeSelectOption value="reject">申請を却下</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field orientation="horizontal" className="md:col-span-2">
          <div>
            <FieldLabel htmlFor={`delegation-${index}`}>代理承認</FieldLabel>
            <FieldDescription>
              {step.governance_authority === undefined
                ? "期間付き委任をこのステップで利用します。"
                : "会社の任用で許可された期間付き委任のみ利用します。"}
            </FieldDescription>
          </div>
          <Switch
            id={`delegation-${index}`}
            checked={step.allow_delegation}
            onCheckedChange={(checked) => props.onChange({ ...step, allow_delegation: checked })}
          />
        </Field>
        {step.governance_authority === undefined ? (
          <>
            <Field className="md:col-span-2">
              <FieldLabel>承認者</FieldLabel>
              <div className="flex flex-col gap-2">
                {step.approvers.map((selector, selectorIndex) => (
                  <ApproverRow
                    key={selectorIndex}
                    selector={selector}
                    typeInputId={`workflow-step-${index}-approver-${selectorIndex}-type`}
                    typeInputLabel={`ステップ ${index + 1} 承認者 ${selectorIndex + 1} の種類`}
                    onChange={(next) =>
                      props.onChange({
                        ...step,
                        approvers: step.approvers.map((item, i) =>
                          i === selectorIndex ? next : item,
                        ),
                      })
                    }
                    onDelete={() =>
                      props.onChange({
                        ...step,
                        approvers: step.approvers.filter((_, i) => i !== selectorIndex),
                      })
                    }
                    canDelete={step.approvers.length > 1}
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    props.onChange({
                      ...step,
                      approvers: [...step.approvers, { type: "direct_manager" }],
                    })
                  }
                >
                  承認者を追加
                </Button>
              </div>
            </Field>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
