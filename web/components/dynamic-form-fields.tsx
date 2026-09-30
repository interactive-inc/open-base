"use client"

import { useState } from "react"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/empty-state"
import type { FormSchema } from "@/lib/application/form-schema"

/**
 * 申請テンプレートのスキーマ JSON を読み、入力フォームの中身を動的に並べる。
 * 入力値はローカル state で集めて、submit 時に hidden input "payload" に JSON で書き出す。
 */
type Props = {
  schema: FormSchema
  name: string
}

type FieldValue = string | number

function initialValues(schema: FormSchema): Record<string, FieldValue> {
  const result: Record<string, FieldValue> = {}

  for (const field of schema.fields) {
    result[field.id] = ""
  }

  return result
}

export function DynamicFormFields(props: Props) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initialValues(props.schema),
  )

  if (props.schema.fields.length === 0) {
    return (
      <EmptyState
        title="このテンプレートには入力項目がありません"
        description="管理者がテンプレートに項目を追加すると、ここから入力できるようになります。"
      />
    )
  }

  function setValue(id: string, value: FieldValue) {
    setValues({ ...values, [id]: value })
  }

  return (
    <FieldGroup>
      <input type="hidden" name={props.name} value={JSON.stringify(values)} />

      {props.schema.fields.map((field) => {
        const inputId = `field-${field.id}`

        return (
          <Field key={field.id}>
            <FieldLabel htmlFor={inputId}>
              {field.label}
              {field.required ? (
                <abbr title="必須" className="ml-2 text-destructive no-underline">
                  *
                </abbr>
              ) : null}
            </FieldLabel>

            {field.type === "text" ? (
              <Input
                id={inputId}
                value={values[field.id] ?? ""}
                required={field.required}
                aria-required={field.required}
                onChange={(event) => setValue(field.id, event.target.value)}
              />
            ) : null}

            {field.type === "textarea" ? (
              <Textarea
                id={inputId}
                rows={4}
                value={values[field.id] ?? ""}
                required={field.required}
                aria-required={field.required}
                onChange={(event) => setValue(field.id, event.target.value)}
              />
            ) : null}

            {field.type === "number" ? (
              <Input
                id={inputId}
                type="number"
                value={values[field.id] ?? ""}
                required={field.required}
                aria-required={field.required}
                onChange={(event) => {
                  const rawValue = event.currentTarget.value
                  const numericValue = event.currentTarget.valueAsNumber

                  setValue(
                    field.id,
                    rawValue === "" || Number.isNaN(numericValue) ? "" : numericValue,
                  )
                }}
              />
            ) : null}

            {field.type === "date" ? (
              <Input
                id={inputId}
                type="date"
                value={values[field.id] ?? ""}
                required={field.required}
                aria-required={field.required}
                onChange={(event) => setValue(field.id, event.target.value)}
              />
            ) : null}

            {field.type === "select" ? (
              <NativeSelect
                id={inputId}
                value={values[field.id] ?? ""}
                required={field.required}
                aria-required={field.required}
                className="w-full"
                onChange={(event) => setValue(field.id, event.target.value)}
              >
                <NativeSelectOption value="">選択してください</NativeSelectOption>

                {(field.options ?? []).map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}

            {field.description !== null && field.description !== "" ? (
              <FieldDescription>{field.description}</FieldDescription>
            ) : null}
          </Field>
        )
      })}
    </FieldGroup>
  )
}
