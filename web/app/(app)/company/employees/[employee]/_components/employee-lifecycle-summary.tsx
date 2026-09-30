import { EmployeeStatusBadge } from "@/app/(app)/company/employees/_components/employee-status-badge"
import { formatLifecycleDate } from "@/app/(app)/company/employees/[employee]/_lib/format-lifecycle-date"
import { DetailField } from "@/components/detail-field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EmployeeLifecycleState } from "@/lib/api/get-employee-lifecycle-state"

export function EmployeeLifecycleSummary(props: { state: EmployeeLifecycleState }) {
  const primary = props.state.primary_assignment
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-4">
          現在の人事状態
          <EmployeeStatusBadge status={props.state.status} />
        </CardTitle>
        <CardDescription>
          {formatLifecycleDate(props.state.as_of)}時点の確定済み情報
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="主所属">{primary?.department_name ?? "未配属"}</DetailField>
          <DetailField label="役職">{primary?.position_title ?? "-"}</DetailField>
          <DetailField label="直属上司">{primary?.manager_employee_code ?? "未設定"}</DetailField>
          <DetailField label="兼務">
            {props.state.concurrent_assignments.length === 0
              ? "なし"
              : props.state.concurrent_assignments
                  .map((assignment) => assignment.department_name)
                  .join("、")}
          </DetailField>
          <DetailField label="部署責任">
            {props.state.responsibility_department_codes.join("、") || "なし"}
          </DetailField>
          <DetailField label="雇用期間ID">
            <span className="break-all">{props.state.employment_period_id ?? "-"}</span>
          </DetailField>
        </dl>
      </CardContent>
    </Card>
  )
}
