"use client"

import { EmploymentTypeField } from "@/app/(app)/company/employees/_components/employment-type-field"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createEmployeeAction } from "@/app/(app)/company/employees/actions"
import type { EmployeeCreateFormState } from "@/app/(app)/company/employees/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { usePersonnelPositionSnapshot } from "@/lib/employee/use-personnel-position-snapshot"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: EmployeeCreateFormState = { ok: false, error: null }

/**
 * 従業員登録フォーム。人物、入社発令、初期アカウントを一括作成する。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function EmployeeCreateForm(props: { canAssignRole: boolean; companyRevision: number }) {
  const positionSnapshot = usePersonnelPositionSnapshot(props.companyRevision)
  const router = useRouter()

  async function reduce(
    previousState: EmployeeCreateFormState,
    formData: FormData,
  ): Promise<EmployeeCreateFormState> {
    if (!positionSnapshot.isReady) return { ok: false, error: "有効日の会社情報を確認してください" }
    const result = await createEmployeeAction(previousState, formData)

    if (result.ok) {
      toast.success("従業員を登録しました")

      router.push("/company/employees")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="company_revision" value={props.companyRevision} />
      {positionSnapshot.error ? <FieldError>{positionSnapshot.error}</FieldError> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="employee-code">従業員コード</FieldLabel>

          <Input
            id="employee-code"
            name="code"
            placeholder="例: E100…"
            autoComplete="off"
            spellCheck={false}
            maxLength={FORM_CONSTRAINTS.employee.codeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-name">氏名</FieldLabel>

          <Input
            id="employee-name"
            name="name"
            placeholder="例: Sam Rivers…"
            autoComplete="name"
            maxLength={FORM_CONSTRAINTS.employee.nameMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-hire-on">入社日</FieldLabel>

          <Input
            value={positionSnapshot.effectiveOn}
            onChange={(event) => {
              void positionSnapshot.changeEffectiveOn(event.target.value)
            }}
            id="employee-hire-on"
            name="hire_on"
            type="date"
            autoComplete="off"
            required
          />
          <FieldDescription>
            未来日を指定した場合、入社日までは入社予定としてログインできません。
          </FieldDescription>
        </Field>

        <EmploymentTypeField id="employee-employment-type" isVisible />

        <Field>
          <FieldLabel htmlFor="employee-email">メール</FieldLabel>

          <Input
            id="employee-email"
            name="email"
            type="email"
            placeholder="例: you@example.com…"
            autoComplete="off"
            spellCheck={false}
            maxLength={FORM_CONSTRAINTS.employee.emailMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-password">初期パスワード</FieldLabel>

          <Input
            id="employee-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={FORM_CONSTRAINTS.employee.passwordMin}
            maxLength={FORM_CONSTRAINTS.employee.passwordMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-role">システム権限セット</FieldLabel>

          {props.canAssignRole ? (
            <NativeSelect
              aria-label="システム権限セット"
              id="employee-role"
              name="role"
              defaultValue="member"
              className="w-full"
              autoComplete="off"
              required
            >
              <NativeSelectOption value="member">標準利用者</NativeSelectOption>
              <NativeSelectOption value="manager">業務管理者</NativeSelectOption>
              <NativeSelectOption value="hr">人事管理者</NativeSelectOption>
              <NativeSelectOption value="root">システム管理者</NativeSelectOption>
            </NativeSelect>
          ) : (
            <>
              <Input id="employee-role" value="標準利用者" readOnly />
              <input type="hidden" name="role" value="member" />
            </>
          )}
          <FieldDescription>
            何を操作できるかを設定します。直属上司や部署責任者など、誰に対して操作できるかは組織図で別に管理します。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-department-code">配属先部署コード（任意）</FieldLabel>

          <Input
            id="employee-department-code"
            name="department_code"
            placeholder="例: D003…"
            autoComplete="off"
            spellCheck={false}
            maxLength={FORM_CONSTRAINTS.employee.codeMax}
          />
          <FieldDescription>
            部署名ではなく、組織図の変更されない部署コードを指定します。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-position">役職（任意）</FieldLabel>

          <NativeSelect
            id="employee-position"
            name="position_code"
            key={positionSnapshot.effectiveOn}
            disabled={!positionSnapshot.isReady}
            defaultValue=""
            className="w-full"
            autoComplete="off"
          >
            <NativeSelectOption value="">役職なし</NativeSelectOption>
            {positionSnapshot.positions.map((position) => (
              <NativeSelectOption key={position.id} value={position.code}>
                {position.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            役職は配属先部署とあわせて指定します。役職マスタから選び、空欄は役職なしです。
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-manager-code">直属上司コード（任意）</FieldLabel>

          <Input
            id="employee-manager-code"
            name="manager_employee_code"
            placeholder="例: E004…"
            autoComplete="off"
            spellCheck={false}
            maxLength={FORM_CONSTRAINTS.employee.codeMax}
          />
          <FieldDescription>
            システムロールとは別の組織関係として、入社発令に記録されます。
          </FieldDescription>
        </Field>

        {state.error !== null ? (
          <div aria-live="polite">
            <FieldError>{state.error}</FieldError>
          </div>
        ) : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending || !positionSnapshot.isReady}>
            {isPending ? "登録中…" : "従業員を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
