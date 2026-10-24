import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { Context } from "@/env"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"

export type Props = {
  c: Context
  employeeIdParam: string | undefined
  employeeCodeParam: string | undefined
  sessionEmployeeId: EmployeeId
}

/**
 * リスト系ルートの対象従業員 id を、employee_id / employee_code のいずれか（未指定は本人）から解決する。
 * employee_code 指定時はCompanyのcanonical Employee IDへ解決する。解決できない code はnullを返す。
 */
export async function resolveTargetEmployeeId(props: Props): Promise<EmployeeId | null | Error> {
  if (props.employeeCodeParam !== undefined) {
    const repository = openCompanyEmployeeDirectory(props.c)

    const employee = await repository.findByCode(props.employeeCodeParam)

    if (employee instanceof Error) {
      return employee
    }

    return employee === null ? null : employee.id
  }

  if (props.employeeIdParam !== undefined) {
    const parsed = zEmployeeId.safeParse(props.employeeIdParam)

    return parsed.success ? parsed.data : null
  }

  return props.sessionEmployeeId
}
