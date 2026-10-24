import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import type {
  WorkforceInvariantCode,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { validateWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/validate-workforce-lifecycle-schedules.policy"
import { CompanyOperationError, CompanyConflictError } from "@/contexts/company/domain/errors"

type ValidateLifecycleSchedulesProps = {
  schedules: ReadonlyArray<LifecycleSchedule>
  departments: ReadonlyArray<OrganizationUnitPeriod>
}

type InvariantConflict = Readonly<{
  message: string
  code:
    | "employment_period_conflict"
    | "status_period_conflict"
    | "primary_assignment_conflict"
    | "assignment_period_conflict"
    | "manager_cycle"
    | "manager_not_active"
    | "department_not_active"
    | "lifecycle_projection_mismatch"
}>

const invariantConflictByInvariant: Readonly<Record<WorkforceInvariantCode, InvariantConflict>> = {
  invalid_employee: {
    message: "人事ライフサイクルの従業員投影が不正です",
    code: "lifecycle_projection_mismatch",
  },
  invalid_period: {
    message: "人事ライフサイクルの期間投影が不正です",
    code: "lifecycle_projection_mismatch",
  },
  duplicate_period: {
    message: "人事ライフサイクルの期間IDが重複しています",
    code: "lifecycle_projection_mismatch",
  },
  employee_mismatch: {
    message: "人事ライフサイクルの従業員対応が不正です",
    code: "lifecycle_projection_mismatch",
  },
  employment_overlap: {
    message: "雇用期間が重複しています",
    code: "employment_period_conflict",
  },
  status_outside_employment: {
    message: "状態期間が雇用期間の外にあります",
    code: "status_period_conflict",
  },
  status_gap_or_overlap: {
    message: "雇用期間の状態に重複または欠落があります",
    code: "status_period_conflict",
  },
  assignment_outside_employment: {
    message: "所属期間が雇用期間の外にあります",
    code: "assignment_period_conflict",
  },
  inactive_organization_unit: {
    message: "利用できない部署が指定されています",
    code: "department_not_active",
  },
  primary_assignment_overlap: {
    message: "主所属が重複しています",
    code: "primary_assignment_conflict",
  },
  assignment_overlap: {
    message: "同じ部署の所属期間が重複しています",
    code: "assignment_period_conflict",
  },
  self_manager: {
    message: "本人を直属上司にはできません",
    code: "manager_cycle",
  },
  responsibility_outside_employment: {
    message: "部署責任者が対象期間に在籍していません",
    code: "manager_not_active",
  },
  responsibility_without_assignment: {
    message: "部署責任者が対象部署に所属していません",
    code: "assignment_period_conflict",
  },
  invalid_responsibility: {
    message: "組織責務の識別子が不正です",
    code: "lifecycle_projection_mismatch",
  },
  responsibility_overlap: {
    message: "同じ部署の責任期間が重複しています",
    code: "assignment_period_conflict",
  },
  manager_not_active: {
    message: "直属上司が対象日に在籍していません",
    code: "manager_not_active",
  },
  manager_cycle: {
    message: "上司関係が循環しています",
    code: "manager_cycle",
  },
  account_link_mismatch: {
    message: "人事ライフサイクルに不正なアカウント対応があります",
    code: "lifecycle_projection_mismatch",
  },
  duplicate_account_link: {
    message: "人事ライフサイクルに重複したアカウント対応があります",
    code: "lifecycle_projection_mismatch",
  },
}

function toInvariantConflict(violation: WorkforceInvariantViolation): CompanyOperationError {
  const conflict = invariantConflictByInvariant[violation.code]
  return new CompanyConflictError(conflict.message, conflict.code)
}

/** 既存公開エラー契約を保ちつつ、検証規則の正本を共通Workforce Domainへ委譲する。 */
export function validateLifecycleSchedules(
  props: ValidateLifecycleSchedulesProps,
): CompanyOperationError | undefined {
  try {
    const violation = validateWorkforceLifecycleSchedules({
      schedules: toWorkforceLifecycleSchedules(props.schedules),
      organizationUnitPeriods: props.departments,
    })

    return violation === null ? undefined : toInvariantConflict(violation)
  } catch (cause) {
    return new CompanyConflictError(
      "人事ライフサイクルを共通モデルへ投影できません",
      "lifecycle_projection_mismatch",
      { cause },
    )
  }
}
