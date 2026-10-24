import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"

type Context = D1Database

/** 公開APIと既存の組織変更が共有する、期間台帳の一括保存statement。 */
export class OrganizationUnitChangeStatementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  prepare(
    change: OrganizationWorkforceChangeEntity,
    requestFingerprint: string,
  ): ReadonlyArray<D1PreparedStatement> {
    const statements: D1PreparedStatement[] = [
      this.c
        .prepare(
          `INSERT INTO company_organization_change_operations
           (id, expected_revision, change_count, applied_count, resulting_revision, status,
            recorded_at, actor_account_id, reason, evidence_references_json,
            request_fingerprint, operation_key)
         VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(
          change.operationId,
          change.expectedRevision,
          change.periodCount,
          change.recordedAt,
          change.actorAccountId,
          change.reason,
          JSON.stringify(change.evidenceReferences),
          requestFingerprint,
          change.operationKey,
        ),
    ]
    for (const period of change.responsibilities.filter((period) => period.isVoid)) {
      statements.push(this.responsibilityStatement(period))
    }
    for (const period of change.assignments.filter((period) => period.isVoid)) {
      statements.push(this.assignmentStatement(period))
    }
    for (const identity of change.organizationUnits) {
      statements.push(
        this.c
          .prepare("INSERT INTO company_organization_units (id, created_at) VALUES (?1, ?2)")
          .bind(identity.id, identity.createdAt),
      )
    }
    for (const period of change.unitPeriods) {
      statements.push(
        this.c
          .prepare(
            `INSERT INTO company_organization_unit_period_versions
             (period_id, revision, organization_unit_id, code, official_name, kind,
              parent_organization_unit_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.organizationUnitId,
            period.code,
            period.officialName,
            period.kind,
            period.parentOrganizationUnitId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
      )
    }
    for (const period of change.assignments.filter((period) => !period.isVoid)) {
      statements.push(this.assignmentStatement(period))
    }
    for (const period of change.responsibilities.filter((period) => !period.isVoid)) {
      statements.push(this.responsibilityStatement(period))
    }
    statements.push(
      this.c
        .prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1 AND status = 'PENDING'",
        )
        .bind(change.operationId),
    )
    return statements
  }

  private assignmentStatement(period: OrgAssignmentPeriod): D1PreparedStatement {
    return this.c
      .prepare(`INSERT INTO company_organization_assignment_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type,
       position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
      .bind(
        period.periodId,
        period.revision,
        period.employmentId,
        period.employeeId,
        period.organizationUnitId,
        period.assignmentType,
        period.positionTitle,
        period.managerEmployeeId,
        period.startsOn,
        period.endsOn,
        period.isVoid ? 1 : 0,
        period.recordedByActionId,
        period.recordedAt,
      )
  }
  private responsibilityStatement(period: OrgResponsibilityPeriod): D1PreparedStatement {
    return this.c
      .prepare(`INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`)
      .bind(
        period.periodId,
        period.revision,
        period.employmentId,
        period.employeeId,
        period.organizationUnitId,
        period.responsibilityType,
        period.startsOn,
        period.endsOn,
        period.isVoid ? 1 : 0,
        period.recordedByActionId,
        period.recordedAt,
      )
  }
}
