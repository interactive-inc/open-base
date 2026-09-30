import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"

export type Props = {
  c: Context
  employeeId: EmployeeId | undefined
  employeeCode: string | undefined
}

/**
 * 登録系ルートの対象従業員 id を、リクエストボディの employee_id / employee_code のいずれかから解決する。
 * employee_code 指定時はCompanyのcanonical Employee IDへ解決する。解決できない code はnullを返す。
 * どちらを渡すかの検証（exactly one）は各ルートの zValidator が行う。
 */
export async function resolveEmployeeIdFromBody(props: Props): Promise<EmployeeId | null | Error> {
  if (props.employeeId !== undefined) {
    return props.employeeId
  }

  if (props.employeeCode !== undefined) {
    const repository = openCompanyEmployeeDirectory(props.c)

    const employee = await repository.findByCode(props.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    return employee === null ? null : employee.id
  }

  return null
}
