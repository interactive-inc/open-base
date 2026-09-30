"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { WorkflowApproverSelector } from "@/lib/api/types/application-workflow-types"

/** 従業員や上長による承認者指定を編集する。 */
export function ApproverRow(props: {
  selector: WorkflowApproverSelector
  typeInputId: string
  typeInputLabel: string
  onChange: (selector: WorkflowApproverSelector) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const value =
    props.selector.type === "role"
      ? props.selector.role_key
      : props.selector.type === "employee"
        ? props.selector.employee_code
        : ""
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <NativeSelect
        id={props.typeInputId}
        aria-label={props.typeInputLabel}
        value={props.selector.type}
        onChange={(event) => {
          const type = event.target.value
          if (type === "employee") props.onChange({ type, employee_code: "" })
          else if (
            type === "direct_manager" ||
            type === "department_manager" ||
            type === "target_department_manager" ||
            type === "management_chain"
          )
            props.onChange({ type })
        }}
      >
        <NativeSelectOption value="direct_manager">直属上司</NativeSelectOption>
        <NativeSelectOption value="department_manager">部門責任者</NativeSelectOption>
        <NativeSelectOption value="target_department_manager">異動先部門責任者</NativeSelectOption>
        <NativeSelectOption value="management_chain">上位管理職全員</NativeSelectOption>
        {props.selector.type === "responsibility" ? (
          <NativeSelectOption value="responsibility" disabled>
            組織責務（移行が必要）
          </NativeSelectOption>
        ) : null}
        {props.selector.type === "role" ? (
          <NativeSelectOption value="role" disabled>
            IAMロール（移行が必要）
          </NativeSelectOption>
        ) : null}
        <NativeSelectOption value="employee">従業員指定</NativeSelectOption>
      </NativeSelect>
      {props.selector.type === "responsibility" ? (
        <p>
          責務: {props.selector.responsibility_type} / 組織:{" "}
          {props.selector.organization_unit_code ?? "全組織"}
        </p>
      ) : props.selector.type === "role" ? (
        <p>旧ロール: {props.selector.role_key}</p>
      ) : props.selector.type === "employee" ? (
        <Input
          aria-label="従業員コード"
          placeholder="E001"
          value={value}
          onChange={(event) =>
            props.onChange({ type: "employee", employee_code: event.target.value })
          }
        />
      ) : (
        <div />
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!props.canDelete}
        onClick={props.onDelete}
      >
        削除
      </Button>
    </div>
  )
}
