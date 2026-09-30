import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { EmployeeSearchFilter } from "@/lib/api/types/employee-search-filter"

type Props = {
  filter: EmployeeSearchFilter
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "active", label: "在籍" },
  { value: "leave", label: "休職" },
  { value: "retired", label: "退職" },
]

/**
 * 従業員一覧の絞り込みフォーム。
 * method=get で /employees に submit し、searchParams を更新する（クライアント JS 不要）。
 */
export function EmployeeSearchForm(props: Props) {
  return (
    <form method="get" action="/company/employees">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-64">
            <Field className="w-full">
              <FieldLabel htmlFor="employee-search-q">キーワード</FieldLabel>

              <Input
                id="employee-search-q"
                name="q"
                type="search"
                defaultValue={props.filter.q ?? ""}
                placeholder="氏名・メールなど"
              />
            </Field>
          </div>

          <div className="sm:w-48">
            <Field className="w-full">
              <FieldLabel htmlFor="employee-search-dept">部署</FieldLabel>

              <Input
                id="employee-search-dept"
                name="dept"
                type="text"
                defaultValue={props.filter.dept ?? ""}
                placeholder="部署名"
              />
            </Field>
          </div>

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="employee-search-status">在籍状況</FieldLabel>

              <NativeSelect
                id="employee-search-status"
                name="status"
                defaultValue={props.filter.status ?? ""}
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
