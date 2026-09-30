import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { AssignmentResourceAdoptionEntity } from "@/contexts/company/domain/entities/assignment-resource-adoption.entity"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { AssignmentResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/assignment-resource-adoption-snapshot.adapter"
import type { AssignmentResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/assignment-resource-adoption-snapshot.value"
import { AssignmentReportingAdoptionChangeValue } from "@/contexts/company/domain/values/assignment-reporting-adoption-change.value"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { OrganizationUnitChangeStatementAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-unit-change-statement.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { ValidateOrganizationChange } from "@/contexts/company/lib/workforce/validate-organization-change"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyOperationError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = CompanyContext
export type AssignmentResourceAdoptionResult = Readonly<{
  employeeId: string
  organizationRevision: number
  adoptedPeriods: number
  replayed: boolean
}>
const receiptSchema = z.object({
  fingerprint: z.string(),
  employee_id: z.string(),
  organization_revision: z.number().int().positive(),
  adopted_periods: z.number().int().positive(),
})

/** 元の所属・上長履歴を保持し、公開履歴と期間対応を原子的に接続する。 */
export class AssignmentResourceAdoptionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async adopt(
    command: AssignmentResourceAdoptionEntity,
  ): Promise<AssignmentResourceAdoptionResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({ ...command.props, recordedAt: null })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const snapshot = await new AssignmentResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.employeeId,
      )
      if (snapshot instanceof Error) return this.unavailable(snapshot)
      if (snapshot === null)
        return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")
      const applied = await this.apply(command, fingerprint, snapshot).catch((cause: unknown) => {
        if (
          cause instanceof Error &&
          /company (?:reporting employment|personnel reporting (?:owner|assignment))/.test(
            cause.message,
          )
        )
          return this.invalid(cause)
        return this.unavailable(cause)
      })
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, fingerprint)
      if (raced !== null) return raced
      const current = await new AssignmentResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.employeeId,
      )
      if (
        current === null ||
        (!(current instanceof Error) && current.props.digest !== command.props.snapshotDigest)
      )
        return this.conflict()
      return applied
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private async apply(
    command: AssignmentResourceAdoptionEntity,
    fingerprint: string,
    snapshot: AssignmentResourceAdoptionSnapshotValue,
  ): Promise<AssignmentResourceAdoptionResult | CompanyOperationError> {
    const today = resolveCompanyBusinessDate({
      now: new Date(command.props.recordedAt).toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (today instanceof Error) return this.unavailable(today)
    if (today !== command.props.observedOn) return this.conflict()
    const database = this.c.env.DB
    const snapshots = new AssignmentResourceAdoptionSnapshotAdapter(database)
    const assignments = await command.toAssignments(snapshot)
    if (assignments instanceof CompanyOperationError) return assignments
    if (assignments instanceof Error) return this.invalid(assignments)
    const occupied = await database
      .prepare(`SELECT 1 AS present FROM company_resource_heads
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'assignment'
        AND resource_id IN (SELECT value FROM json_each(?1)) LIMIT 1`)
      .bind(
        JSON.stringify(
          assignments
            .filter((entry) => entry.resource.revision === 1)
            .map((entry) => entry.resource.id),
        ),
      )
      .first()
    if (occupied !== null) return this.conflict()
    const first = assignments[0]
    if (first === undefined) return this.invalid(new Error("empty assignment adoption"))
    const change = OrganizationWorkforceChangeEntity.restore({
      operationId: first.period.recordedByActionId,
      operationKey: `assignment-adoption:${command.props.snapshotDigest}`,
      expectedRevision: snapshot.props.value.lifecycleRevision,
      asOf: restoreCalendarDate(command.props.observedOn),
      recordedAt: command.props.recordedAt,
      actorAccountId: command.props.actorAccountId,
      reason: command.props.reason,
      evidenceReferences: [
        {
          context: "company",
          kind: "assignment-adoption",
          id: command.props.commandId,
          version: command.props.snapshotDigest,
        },
      ],
      organizationUnits: [],
      unitPeriods: [],
      assignments: assignments.map((entry) => entry.period),
      responsibilities: [],
    })
    if (change instanceof Error) return this.invalid(change)
    const validation = await new ValidateOrganizationChange({
      organization: new OrganizationUnitReadAdapter(drizzle(database)),
      workforce: new OrganizationWorkforceSnapshotAdapter(this.c),
    }).execute(change)
    if (validation.kind === "conflict" || validation.kind === "operation_conflict")
      return this.conflict()
    if (validation.kind === "invalid") return this.invalid(validation.error)
    if (validation.kind !== "valid") return this.unavailable(validation.cause)
    const units = await database
      .prepare(
        `SELECT organization_unit_id FROM company_organization_resource_bindings WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .all<{ organization_unit_id: string }>()
    if (!units.success) return this.unavailable(new Error("organization bindings unavailable"))
    if (
      assignments.some(
        (entry) =>
          !units.results.some(
            (unit) => unit.organization_unit_id === entry.period.organizationUnitId,
          ),
      )
    )
      return this.invalid(new Error("organization history is not connected"))
    const repository = new D1CompanyResourceRepository({ database })
    const history = await repository.findReportingRelationHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      command.props.expectedRevision,
    )
    if (history instanceof Error) return this.unavailable(history)
    const selected = await database
      .prepare(`SELECT resource_id AS resourceId, employee_id AS employeeId, employment_id AS employmentId,
      organization_unit_id AS organizationUnitId, assignment_type AS assignmentType FROM company_personnel_reporting_bindings WHERE employee_id = ?1`)
      .bind(command.props.employeeId)
      .all()
    if (!selected.success) return this.unavailable(new Error("reporting bindings unavailable"))
    const scopes = z
      .array(
        z.object({
          resourceId: z.string(),
          employeeId: z.string(),
          employmentId: z.string(),
          organizationUnitId: z.string(),
          assignmentType: z.enum(["PRIMARY", "CONCURRENT"]),
        }),
      )
      .parse(selected.results)
    const reporting = await AssignmentReportingAdoptionChangeValue.create({
      snapshot,
      history,
      scopes,
    })
    if (reporting instanceof Error) return this.invalid(reporting)
    const timeline = CompanyReportingRelationTimelineValue.create([
      ...history,
      ...reporting.resources,
    ])
    if (timeline instanceof Error) return this.invalid(timeline)
    const legacy = await database
      .prepare(`SELECT period_id, employee_id AS employeeId, manager_employee_id AS managerEmployeeId,
      organization_unit_id AS organizationUnitId, starts_on AS startsOn, ends_on AS endsOn FROM company_organization_assignment_period_versions period
      WHERE is_void = 0 AND manager_employee_id IS NOT NULL AND revision = (SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)`)
      .all<{
        period_id: string
        employeeId: string
        managerEmployeeId: string
        organizationUnitId: string
        startsOn: string
        endsOn: string | null
      }>()
    if (!legacy.success) return this.unavailable(new Error("legacy reporting history unavailable"))
    if (
      timeline.hasManagementCycle(
        legacy.results.filter(
          (period) => !assignments.some((entry) => entry.period.periodId === period.period_id),
        ),
      )
    )
      return this.invalid(new Error("reporting graph contains a cycle"))
    const changes = command.toChanges([
      ...assignments.map((entry) => entry.resource),
      ...reporting.resources,
    ])
    if (changes instanceof Error) return this.invalid(changes)
    const native = new OrganizationUnitChangeStatementAdapter(database).prepare(change, fingerprint)
    const completed = native.at(-1)
    if (completed === undefined)
      return this.unavailable(new Error("organization completion statement missing"))
    const statements = [snapshots.prepareGuard(snapshot), ...native.slice(0, -1)]
    const journal = new CompanyResourceJournalAdapter({ database: drizzle(database), d1: database })
    for (const publicChange of changes) {
      const prepared = await journal.prepare(publicChange)
      if (prepared instanceof Error) return this.unavailable(prepared)
      statements.push(...prepared.statements, prepared.commit)
    }
    const organizationRevision = command.props.expectedRevision + changes.length
    const insertedResources = new Set<string>()
    for (const entry of assignments) {
      if (!insertedResources.has(entry.resource.id)) {
        insertedResources.add(entry.resource.id)
        statements.push(
          database
            .prepare(`INSERT INTO company_assignment_resource_bindings
          (resource_id, organization_id, employee_id, resource_revision, recorded_at)
          VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2, ?3, ?4)`)
            .bind(
              entry.resource.id,
              command.props.employeeId,
              entry.resource.revision,
              command.props.recordedAt,
            ),
        )
      }
      statements.push(
        database
          .prepare(`INSERT INTO company_assignment_period_bindings
        (period_id, resource_id, period_revision, source_revision) VALUES (?1, ?2, ?3, ?4)`)
          .bind(
            entry.period.periodId,
            entry.resource.id,
            entry.period.revision,
            entry.resource.revision,
          ),
      )
    }
    statements.push(
      database
        .prepare(`INSERT INTO company_assignment_resource_adoptions
      (command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, recorded_at, adopted_periods, mappings_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
        .bind(
          command.props.commandId,
          command.props.employeeId,
          fingerprint,
          command.props.actorAccountId,
          command.props.reason,
          command.props.expectedRevision,
          organizationRevision,
          command.props.observedOn,
          snapshot.props.digest,
          snapshot.props.sourceJson,
          command.props.recordedAt,
          assignments.length,
          JSON.stringify(command.props.mappings ?? []),
        ),
    )
    for (const scope of reporting.scopes) {
      statements.push(
        database
          .prepare(`INSERT INTO company_personnel_reporting_bindings
        (resource_id, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_adoption_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
          .bind(
            scope.resourceId,
            scope.employeeId,
            scope.employmentId,
            scope.organizationUnitId,
            scope.assignmentType,
            command.props.commandId,
          ),
      )
    }
    statements.push(completed)
    await database.batch(statements)
    return {
      employeeId: command.props.employeeId,
      organizationRevision,
      adoptedPeriods: assignments.length,
      replayed: false,
    }
  }

  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<AssignmentResourceAdoptionResult | CompanyConflictError | null> {
    const row = await this.c.env.DB.prepare(
      `SELECT fingerprint, employee_id, organization_revision, adopted_periods FROM company_assignment_resource_adoptions WHERE command_id = ?1`,
    )
      .bind(commandId)
      .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint) return this.conflict()
    return {
      employeeId: receipt.employee_id,
      organizationRevision: receipt.organization_revision,
      adoptedPeriods: receipt.adopted_periods,
      replayed: true,
    }
  }
  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "移行対象または依頼が変更されています。再確認してください",
      "assignment_resource_adoption_conflict",
    )
  }
  private invalid(cause: unknown): CompanyValidationError {
    return new CompanyValidationError(
      "所属・上長の履歴と接続先を確認してください",
      "invalid_assignment_adoption",
      { cause },
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "所属履歴の移行を安全に確定できません",
      "assignment_resource_adoption_unavailable",
      { cause },
    )
  }
}
