import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import Link from "next/link"

type TemplateOption = {
  code: string
  name: string
}

type Props = {
  statusValue: "pending" | "approved" | "rejected" | ""
  templateCodeValue: string
  applicantIdValue: string
  fromValue: string
  toValue: string
  templates: ReadonlyArray<TemplateOption>
}

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

/**
 * 全社申請一覧の絞り込みフォーム。GET submit で searchParams を更新する（クライアント JS 不要）。
 * applicant_id は EmployeeCombobox でなく数値入力で受ける（詳細画面「この人の申請」導線からは
 * searchParams 経由で流入する使い方を想定し、明示的にリセットもしやすい）
 */
export function AdminApplicationsFilterForm(props: Props) {
  const hasActiveFilter =
    props.statusValue !== "" ||
    props.templateCodeValue !== "" ||
    props.applicantIdValue !== "" ||
    props.fromValue !== "" ||
    props.toValue !== ""

  return (
    <form method="get" action="/system/applications">
      <FieldSet>
        <FieldGroup className="flex-row flex-wrap items-end gap-4">
          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-app-status">ステータス</FieldLabel>

              <NativeSelect
                id="admin-app-status"
                name="status"
                defaultValue={props.statusValue}
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

          <div className="sm:w-56">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-app-template">申請テンプレート</FieldLabel>

              <NativeSelect
                id="admin-app-template"
                name="template_code"
                defaultValue={props.templateCodeValue}
                className="w-full"
              >
                <NativeSelectOption value="">すべて</NativeSelectOption>
                {props.templates.map((template) => (
                  <NativeSelectOption key={template.code} value={template.code}>
                    {template.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="sm:w-40">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-app-applicant">申請者 ID</FieldLabel>

              <Input
                id="admin-app-applicant"
                name="applicant_id"
                type="text"
                inputMode="numeric"
                defaultValue={props.applicantIdValue}
                placeholder="例: 5"
              />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-app-from">申請日 (以降)</FieldLabel>

              <Input id="admin-app-from" name="from" type="date" defaultValue={props.fromValue} />
            </Field>
          </div>

          <div className="sm:w-44">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-app-to">申請日 (以前)</FieldLabel>

              <Input id="admin-app-to" name="to" type="date" defaultValue={props.toValue} />
            </Field>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit">絞り込み</Button>

            {hasActiveFilter ? (
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href="/system/applications" />}
              >
                リセット
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
