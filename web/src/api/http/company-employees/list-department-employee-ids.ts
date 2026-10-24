import { readCompanyCanonicalOrganizationState } from "@/contexts/company/interface/operations/read-company-canonical-organization-state"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"

export type Props = {
  c: Context
  departmentCode: string
}

/**
 * 指定部署に所属(主配属・兼務とも)する従業員 id をcanonical Company snapshotから解決する。
 * 下位部署は含まない(部署スコープの既存規約)。部署が存在しない場合も空配列を返す。
 */
export async function listDepartmentEmployeeIds(props: Props): Promise<Array<EmployeeId> | Error> {
  const snapshot = await readCompanyCanonicalOrganizationState(props.c)
  if (snapshot instanceof Error) return snapshot
  const unitIds = new Set(
    snapshot.organization.units
      .filter((unit) => unit.code === props.departmentCode)
      .map((unit) => unit.organizationUnitId),
  )
  if (unitIds.size === 0) return []

  const employeeIds: EmployeeId[] = []
  for (const employee of snapshot.employees) {
    if (
      employee.employmentId === null ||
      (employee.status !== "ACTIVE" && employee.status !== "ON_LEAVE")
    ) {
      continue
    }
    const assignments = [
      ...(employee.primaryAssignment === null ? [] : [employee.primaryAssignment]),
      ...employee.concurrentAssignments,
    ]
    if (!assignments.some((assignment) => unitIds.has(assignment.organizationUnitId))) continue

    employeeIds.push(employee.employeeId)
  }
  return employeeIds.toSorted()
}
