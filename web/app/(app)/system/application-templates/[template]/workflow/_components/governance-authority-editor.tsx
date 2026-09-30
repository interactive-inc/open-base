"use client"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { ApplicationWorkflowStep } from "@/lib/api/types/application-workflow-types"

type Authority = NonNullable<ApplicationWorkflowStep["governance_authority"]>
type Props = { index: number; authority: Authority; onChange: (authority: Authority) => void }

/** 会社の責務と適用範囲を指定し、候補者・合議人数は会社の任用から決める。 */
export function GovernanceAuthorityEditor(props: Props) {
  const scope = props.authority.scope
  const prefix = `governance-${props.index}`
  function changeScope(type: string) {
    if (type === "none") props.onChange({ ...props.authority, scope: null })
    if (type === "region")
      props.onChange({ ...props.authority, scope: { scope_type: type, region_code: "" } })
    if (type === "amount")
      props.onChange({
        ...props.authority,
        scope: { scope_type: type, currency_code: "", amount_field: "" },
      })
    if (
      type === "organization-unit" ||
      type === "legal-entity" ||
      type === "site" ||
      type === "workplace"
    )
      props.onChange({ ...props.authority, scope: { scope_type: type, scope_id: "" } })
  }
  return (
    <div className="flex flex-col gap-4 md:col-span-2">
      <Field>
        <FieldLabel htmlFor={`${prefix}-code`}>会社の責務コード</FieldLabel>
        <Input
          id={`${prefix}-code`}
          value={props.authority.responsibility_code}
          onChange={(event) =>
            props.onChange({ ...props.authority, responsibility_code: event.target.value })
          }
        />
        <FieldDescription>有効な任用から承認者・合議人数・委任制限を決定します。</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-scope`}>責務の適用範囲</FieldLabel>
        <NativeSelect
          id={`${prefix}-scope`}
          value={scope?.scope_type ?? "none"}
          onChange={(event) => changeScope(event.target.value)}
        >
          <NativeSelectOption value="none">範囲を指定しない</NativeSelectOption>
          <NativeSelectOption value="organization-unit">組織</NativeSelectOption>
          <NativeSelectOption value="legal-entity">法人</NativeSelectOption>
          <NativeSelectOption value="site">拠点</NativeSelectOption>
          <NativeSelectOption value="workplace">勤務場所</NativeSelectOption>
          <NativeSelectOption value="region">地域</NativeSelectOption>
          <NativeSelectOption value="amount">金額</NativeSelectOption>
        </NativeSelect>
        <FieldDescription>
          指定しない場合、範囲を限定した任用は承認資格になりません。
        </FieldDescription>
      </Field>
      {scope !== null && "scope_id" in scope ? (
        <Field>
          <FieldLabel htmlFor={`${prefix}-resource`}>適用先ID</FieldLabel>
          <Input
            id={`${prefix}-resource`}
            value={scope.scope_id}
            onChange={(event) =>
              props.onChange({
                ...props.authority,
                scope: { ...scope, scope_id: event.target.value },
              })
            }
          />
        </Field>
      ) : null}
      {scope?.scope_type === "region" ? (
        <Field>
          <FieldLabel htmlFor={`${prefix}-region`}>地域コード</FieldLabel>
          <Input
            id={`${prefix}-region`}
            value={scope.region_code}
            onChange={(event) =>
              props.onChange({
                ...props.authority,
                scope: { ...scope, region_code: event.target.value },
              })
            }
          />
        </Field>
      ) : null}
      {scope?.scope_type === "amount" ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${prefix}-currency`}>通貨コード</FieldLabel>
            <Input
              id={`${prefix}-currency`}
              value={scope.currency_code}
              maxLength={3}
              onChange={(event) =>
                props.onChange({
                  ...props.authority,
                  scope: { ...scope, currency_code: event.target.value },
                })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${prefix}-amount`}>申請内の金額項目</FieldLabel>
            <Input
              id={`${prefix}-amount`}
              value={scope.amount_field}
              onChange={(event) =>
                props.onChange({
                  ...props.authority,
                  scope: { ...scope, amount_field: event.target.value },
                })
              }
            />
          </Field>
        </>
      ) : null}
    </div>
  )
}
