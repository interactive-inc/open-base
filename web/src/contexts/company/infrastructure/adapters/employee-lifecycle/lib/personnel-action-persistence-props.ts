import type { DirectPersonnelActionCommand } from "@/contexts/company/domain/definitions/direct-personnel-action-command.definition"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { PersonnelActionProjection } from "@/contexts/company/domain/policies/project-personnel-action.policy"
import type { PersonnelActionRecord } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"

/**
 * 人事発令を確定するときに、確定文と公開履歴の両方が読む入力。
 *
 * 確定を組み立てる personnel-action-persistence.adapter と、公開雇用履歴を進める
 * company-employment-journal.adapter の双方が要求するため、どちらかの adapter に置くと
 * 型だけの循環依存になる（前者は後者を実行時に呼び、後者は型としてこの形を要求する）。
 */
export type PersonnelActionPersistenceProps = {
  command: DirectPersonnelActionCommand
  action: PersonnelActionRecord
  projection: PersonnelActionProjection
  scheduleBefore: LifecycleSchedule
  businessDate: string
  employeeCodes: ReadonlyMap<EmployeeId, string>
  revisions: { employeeRevision: number; organizationRevision: number }
  prospectiveEmployee?: { code: string; name: string; email?: string | null; accountId?: string }
}
