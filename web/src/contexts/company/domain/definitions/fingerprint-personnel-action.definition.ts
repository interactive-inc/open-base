import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"

/**
 * 人事発令入力のフィンガープリント。冪等性判定で申請内容の同一性を照合する純粋関数
 */
export function fingerprintPersonnelAction(
  employeeId: EmployeeId | `prospective:${string}`,
  input: PersonnelActionInput,
  expectedCompanyRevision?: number,
): Promise<string> {
  return lifecycleSha256(
    stableLifecycleJson({
      employeeId,
      input,
      ...(expectedCompanyRevision === undefined ? {} : { expectedCompanyRevision }),
    }),
  )
}
