import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = { id: string; isVisible: boolean }

/** 新しい雇用を作るとき、区分を既定値で補完せず選択してもらう。 */
export function EmploymentTypeField(props: Props) {
  if (!props.isVisible) return null
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>雇用区分</FieldLabel>
      <NativeSelect id={props.id} name="employment_type" defaultValue="" required>
        <NativeSelectOption value="" disabled>
          選択してください
        </NativeSelectOption>
        <NativeSelectOption value="FULL_TIME">フルタイム</NativeSelectOption>
        <NativeSelectOption value="PART_TIME">パートタイム</NativeSelectOption>
      </NativeSelect>
    </Field>
  )
}
