import type { EmployeeDirectory } from "@/components/app/business-types"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"

/** 担当者の名前を出すための従業員名簿。読めなければ名前の代わりに短いIDを出す。 */
export function useEmployeeDirectory() {
  return useApiJson<EmployeeDirectory>("/company/employee-directory?limit=100")
}

/** 従業員の名前。名簿で見つからなければ、そう分かる文にする。 */
export function employeeName(directory: ApiJsonState<EmployeeDirectory>, id: string): string {
  if (directory.kind === "ok") {
    const found = directory.data.data.find((employee) => employee.id === id)
    if (found !== undefined) return found.name
  }
  return `従業員 ${id.slice(0, 8)}`
}
