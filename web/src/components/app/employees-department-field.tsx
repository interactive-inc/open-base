import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ChoiceField } from "@/components/app/employees-choice-field"
import type { OrganizationUnit } from "@/components/app/employees-types"
import type { ApiJsonState } from "@/components/app/use-api-json"

/** 「指定しない」の選択肢の値。部署のコードと重ならないよう、コードに使えない文字を含める。 */
const NONE = " none"

/**
 * 部署を選ぶ欄。組織の一覧が読めたときは選択肢から選び、読めないときはコードを入力する。
 * `emptyLabel` を渡すと「指定しない」を選択肢の先頭に置き、空文字を返す。
 * `description` はコードを入力するときの案内に使う。
 */
export function DepartmentField(props: {
  label: string
  units: ApiJsonState<ReadonlyArray<OrganizationUnit>>
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  description?: string
}) {
  if (props.units.kind === "ok" && props.units.data.length > 0) {
    const choices = props.units.data.map((unit) => ({
      value: unit.code,
      label: `${unit.name}（${unit.code}）`,
    }))
    const withEmpty = props.emptyLabel !== undefined
    return (
      <ChoiceField
        label={props.label}
        choices={withEmpty ? [{ value: NONE, label: props.emptyLabel ?? "" }, ...choices] : choices}
        value={withEmpty && props.value === "" ? NONE : props.value}
        onChange={(value) => props.onChange(value === NONE ? "" : value)}
      />
    )
  }

  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Input
        value={props.value}
        onValueChange={props.onChange}
        maxLength={64}
        disabled={props.units.kind === "loading"}
      />
      <FieldDescription>
        {props.units.kind === "loading"
          ? "部署の一覧を読み込んでいます。"
          : (props.description ?? "部署のコードを入力してください。")}
      </FieldDescription>
    </Field>
  )
}
