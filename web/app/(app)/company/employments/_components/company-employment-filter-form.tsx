import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  status: string | null
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "ACTIVE", label: "在籍" },
  { value: "ON_LEAVE", label: "休職" },
  { value: "TERMINATED", label: "退職" },
]

/** 雇用一覧の在籍区分フィルタ。method=get で searchParams を更新する。 */
export function CompanyEmploymentFilterForm(props: Props) {
  return (
    <form method="get" action="/company/employments">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="company-employment-status">在籍区分</FieldLabel>

              <NativeSelect
                id="company-employment-status"
                name="status"
                defaultValue={props.status ?? ""}
                className="w-full"
              >
                {statusOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Button type="submit">絞り込み</Button>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
