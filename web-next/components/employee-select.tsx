"use client"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Employee = {
  code: string
  name: string
}

type Props = {
  id: string
  name: string
  employees: ReadonlyArray<Employee>
  defaultValue?: string
  required?: boolean
  className?: string
}

/**
 * 従業員を select で選択する。社員コードの手入力を置き換える共通コンポーネント。
 * Server Action の FormData に name 属性経由で社員コードが乗る。
 */
export function EmployeeSelect(props: Props) {
  return (
    <NativeSelect
      id={props.id}
      name={props.name}
      defaultValue={props.defaultValue ?? ""}
      required={props.required}
      className={props.className}
    >
      <NativeSelectOption value="">選択してください</NativeSelectOption>

      {props.employees.map((employee) => (
        <NativeSelectOption key={employee.code} value={employee.code}>
          {employee.code} - {employee.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
