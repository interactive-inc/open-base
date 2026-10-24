"use client"

import { EmploymentTypeField } from "@/app/(app)/company/employees/_components/employment-type-field"
import { submitPersonnelAction } from "@/app/(app)/company/employees/[employee]/actions"
import type { PersonnelActionFormState } from "@/app/(app)/company/employees/[employee]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { usePersonnelPositionSnapshot } from "@/lib/employee/use-personnel-position-snapshot"
import { useActionState, useState } from "react"
import { toast } from "sonner"

const initialState: PersonnelActionFormState = { ok: false, error: null }

const actions = [
  ["primary_assignment_started", "配属"],
  ["transferred", "異動"],
  ["concurrent_assignment_started", "兼務開始"],
  ["assignment_ended", "所属終了"],
  ["position_changed", "役職変更"],
  ["manager_changed", "上長変更"],
  ["department_responsibility_started", "部署長就任"],
  ["department_responsibility_ended", "部署長退任"],
  ["leave_started", "休職"],
  ["returned", "復職"],
  ["retired", "退職"],
  ["rehire", "再入社"],
] as const

type ActionKind = (typeof actions)[number][0]

export function PersonnelActionForm(props: {
  employeeCode: string
  employeeRevision: number
  organizationRevision: number
  canRequest: boolean
  canApply: boolean
  companyRevision: number
}) {
  const positionSnapshot = usePersonnelPositionSnapshot(props.companyRevision)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ActionKind>("transferred")
  const [mode, setMode] = useState<"apply" | "request">(props.canApply ? "apply" : "request")
  const needsDepartment = !["leave_started", "returned", "retired"].includes(kind)
  const needsAssignment = ["assignment_ended", "position_changed", "manager_changed"].includes(kind)
  const needsPosition = [
    "primary_assignment_started",
    "transferred",
    "concurrent_assignment_started",
    "position_changed",
    "rehire",
  ].includes(kind)
  const needsManager = [
    "primary_assignment_started",
    "transferred",
    "concurrent_assignment_started",
    "manager_changed",
    "rehire",
  ].includes(kind)
  async function reduce(previous: PersonnelActionFormState, form: FormData) {
    if (!positionSnapshot.isReady)
      return { ok: false, error: "発令日時点の役職を読み込めていません。発令日を確認してください" }
    const result = await submitPersonnelAction(previous, form)
    if (result.ok) {
      toast.success(
        form.get("mode") === "apply" ? "人事発令を確定しました" : "人事発令を申請しました",
      )
      setOpen(false)
    } else if (result.error) toast.error(result.error)
    return result
  }
  const [state, action, pending] = useActionState(reduce, initialState)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>人事発令</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overscroll-contain overflow-y-auto">
        <DialogHeader>
          <DialogTitle>人事発令</DialogTitle>
          <DialogDescription>発令日を指定して、承認を申請するか直接確定します。</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="company_revision" value={props.companyRevision} />
          <input type="hidden" name="employee_code" value={props.employeeCode} />
          <input type="hidden" name="employee_revision" value={props.employeeRevision} />
          <input type="hidden" name="organization_revision" value={props.organizationRevision} />
          {positionSnapshot.error ? <FieldError>{positionSnapshot.error}</FieldError> : null}
          <FieldGroup>
            <Field>
              <FieldLabel id="personnel-mode-label" htmlFor="personnel-mode">
                処理方法
              </FieldLabel>
              <NativeSelect
                id="personnel-mode"
                name="mode"
                aria-labelledby="personnel-mode-label"
                className="w-full"
                value={mode}
                onChange={(event) => setMode(event.target.value as "apply" | "request")}
              >
                {props.canRequest ? (
                  <NativeSelectOption value="request">承認を申請</NativeSelectOption>
                ) : null}
                {props.canApply ? (
                  <NativeSelectOption value="apply">直接確定</NativeSelectOption>
                ) : null}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel id="personnel-kind-label" htmlFor="personnel-kind">
                発令の種類
              </FieldLabel>
              <NativeSelect
                id="personnel-kind"
                name="kind"
                aria-labelledby="personnel-kind-label"
                className="w-full"
                value={kind}
                onChange={(event) => setKind(event.target.value as ActionKind)}
              >
                {actions.map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="personnel-date">発令日</FieldLabel>
              <Input
                value={positionSnapshot.effectiveOn}
                onChange={(event) => {
                  void positionSnapshot.changeEffectiveOn(event.target.value)
                }}
                id="personnel-date"
                name="event_on"
                type="date"
                autoComplete="off"
                required
              />
            </Field>
            <EmploymentTypeField id="personnel-employment-type" isVisible={kind === "rehire"} />
            {needsDepartment ? (
              <Field>
                <FieldLabel htmlFor="personnel-department">
                  部署コード{kind === "rehire" ? "（任意）" : ""}
                </FieldLabel>
                <Input
                  id="personnel-department"
                  name="department_code"
                  placeholder="例: D003…"
                  autoComplete="off"
                  spellCheck={false}
                  required={kind !== "rehire"}
                />
                <FieldDescription>部署名ではなく部署コードを入力します。</FieldDescription>
              </Field>
            ) : null}
            {needsAssignment ? (
              <Field>
                <FieldLabel id="personnel-assignment-label" htmlFor="personnel-assignment">
                  所属区分
                </FieldLabel>
                <NativeSelect
                  id="personnel-assignment"
                  name="assignment_type"
                  aria-labelledby="personnel-assignment-label"
                  className="w-full"
                  defaultValue="primary"
                >
                  <NativeSelectOption value="primary">主務</NativeSelectOption>
                  <NativeSelectOption value="concurrent">兼務</NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
            {needsPosition ? (
              <Field>
                <FieldLabel id="personnel-position-label" htmlFor="personnel-position">
                  役職{kind === "position_changed" ? "" : "（任意）"}
                </FieldLabel>
                <NativeSelect
                  id="personnel-position"
                  name="position_code"
                  key={positionSnapshot.effectiveOn}
                  disabled={!positionSnapshot.isReady}
                  aria-labelledby="personnel-position-label"
                  className="w-full"
                  defaultValue=""
                  required={kind === "position_changed"}
                >
                  <NativeSelectOption value="">役職なし</NativeSelectOption>
                  {positionSnapshot.positions.map((position) => (
                    <NativeSelectOption key={position.id} value={position.code}>
                      {position.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>発令日時点の役職から選びます。</FieldDescription>
              </Field>
            ) : null}
            {needsManager ? (
              <Field>
                <FieldLabel htmlFor="personnel-manager">上長の従業員コード（任意）</FieldLabel>
                <Input
                  id="personnel-manager"
                  name="manager_employee_code"
                  placeholder="例: E004…"
                  autoComplete="off"
                  spellCheck={false}
                />
                {kind === "manager_changed" ? (
                  <FieldDescription>空欄にすると上長を解除します。</FieldDescription>
                ) : null}
              </Field>
            ) : null}
            {kind === "position_changed" ? (
              <Field>
                <FieldLabel id="personnel-change-type-label" htmlFor="personnel-change-type">
                  変更の種類
                </FieldLabel>
                <NativeSelect
                  id="personnel-change-type"
                  name="change_type"
                  aria-labelledby="personnel-change-type-label"
                  className="w-full"
                  defaultValue="lateral"
                >
                  <NativeSelectOption value="promotion">昇格</NativeSelectOption>
                  <NativeSelectOption value="demotion">降格</NativeSelectOption>
                  <NativeSelectOption value="lateral">同格の変更</NativeSelectOption>
                  <NativeSelectOption value="other">その他</NativeSelectOption>
                </NativeSelect>
              </Field>
            ) : null}
            {state.error ? (
              <div aria-live="polite">
                <FieldError>{state.error}</FieldError>
              </div>
            ) : null}
            <Button type="submit" disabled={pending || !positionSnapshot.isReady}>
              {pending ? "処理中…" : mode === "apply" ? "人事発令を確定" : "承認を申請"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
