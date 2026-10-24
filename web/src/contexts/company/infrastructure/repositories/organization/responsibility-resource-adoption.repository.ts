import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { ResponsibilityResourceAdoptionEntity } from "@/contexts/company/domain/entities/responsibility-resource-adoption.entity"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { ResponsibilityResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/responsibility-resource-adoption-snapshot.adapter"
import type { ResponsibilityResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/responsibility-resource-adoption-snapshot.value"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { OrganizationUnitChangeStatementAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-unit-change-statement.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
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
export type ResponsibilityResourceAdoptionResult = Readonly<{
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

/** 確認した全責務履歴と接続先を保存し、元の改訂を残して公開履歴へ接続する。 */
export class ResponsibilityResourceAdoptionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async adopt(
    command: ResponsibilityResourceAdoptionEntity,
  ): Promise<ResponsibilityResourceAdoptionResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({ ...command.props, recordedAt: null })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const snapshot = await new ResponsibilityResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.employeeId,
      )
      if (snapshot instanceof Error) return this.unavailable(snapshot)
      if (snapshot === null)
        return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")
      const applied = await this.apply(command, fingerprint, snapshot).catch((cause: unknown) => {
        if (
          cause instanceof Error &&
          /organization responsibility|company_(?:responsibility_assignment_reference_not_found|employment_authority_invalid|governance_organization_reference_invalid|governance_reference_period_not_covered)/.test(
            cause.message,
          )
        )
          return this.invalid(cause)
        return this.unavailable(cause)
      })
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, fingerprint)
      if (raced !== null) return raced
      const current = await new ResponsibilityResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
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
    command: ResponsibilityResourceAdoptionEntity,
    fingerprint: string,
    snapshot: ResponsibilityResourceAdoptionSnapshotValue,
  ): Promise<ResponsibilityResourceAdoptionResult | CompanyOperationError> {
    const today = resolveCompanyBusinessDate({
      now: new Date(command.props.recordedAt).toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (today instanceof Error) return this.unavailable(today)
    if (today !== command.props.observedOn) return this.conflict()
    const database = this.c.env.DB
    const snapshots = new ResponsibilityResourceAdoptionSnapshotAdapter(database)
    const responsibilities = await command.toResponsibilities(snapshot)
    if (responsibilities instanceof CompanyOperationError) return responsibilities
    if (responsibilities instanceof Error) return this.invalid(responsibilities)
    const occupied = await database
      .prepare(`SELECT 1 AS present FROM company_resource_heads
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'responsibility-assignment'
        AND resource_id IN (SELECT value FROM json_each(?1)) LIMIT 1`)
      .bind(
        JSON.stringify(
          responsibilities
            .filter((entry) => entry.resource.revision === 1)
            .map((entry) => entry.resource.id),
        ),
      )
      .first()
    if (occupied !== null) return this.conflict()
    const first = responsibilities[0]
    if (first === undefined) return this.invalid(new Error("empty responsibility adoption"))
    const references = responsibilities.map((entry) => ({
      responsibilityId: entry.resource.readText("responsibilityId"),
      authorityScopeId: entry.resource.readText("authorityScopeId"),
      responsibilityType: entry.period.responsibilityType,
      organizationUnitId: entry.period.organizationUnitId,
      employmentId: entry.period.employmentId,
      employeeId: entry.period.employeeId,
    }))
    const missing = await database
      .prepare(`SELECT requested.value FROM json_each(?1) requested WHERE NOT EXISTS (
        SELECT 1 FROM company_resource_heads responsibility
        JOIN company_resource_heads scope ON scope.organization_id = responsibility.organization_id
        JOIN company_organization_resource_bindings unit ON unit.organization_id = responsibility.organization_id
        JOIN company_workforce_resource_bindings employment ON employment.organization_id = responsibility.organization_id
        WHERE responsibility.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'
          AND responsibility.resource_type = 'responsibility' AND responsibility.resource_id = json_extract(requested.value, '$.responsibilityId')
          AND json_extract(responsibility.attributes_json, '$.code') = json_extract(requested.value, '$.responsibilityType')
          AND scope.resource_type = 'authority-scope' AND scope.resource_id = json_extract(requested.value, '$.authorityScopeId')
          AND json_extract(scope.attributes_json, '$.scopeType') = 'organization-unit'
          AND json_extract(scope.attributes_json, '$.scopeId') = json_extract(requested.value, '$.organizationUnitId') AND unit.organization_unit_id = json_extract(requested.value, '$.organizationUnitId')
          AND employment.resource_type = 'employment' AND employment.resource_id = json_extract(requested.value, '$.employmentId') AND employment.employee_id = json_extract(requested.value, '$.employeeId')
      ) LIMIT 1`)
      .bind(JSON.stringify(references))
      .first()
    if (missing !== null)
      return this.invalid(new Error("responsibility definitions or source ownership do not match"))
    const change = OrganizationWorkforceChangeEntity.restore({
      operationId: first.period.recordedByActionId,
      operationKey: `responsibility-adoption:${command.props.snapshotDigest}`,
      expectedRevision: snapshot.props.value.lifecycleRevision,
      asOf: restoreCalendarDate(command.props.observedOn),
      recordedAt: command.props.recordedAt,
      actorAccountId: command.props.actorAccountId,
      reason: command.props.reason,
      evidenceReferences: [
        {
          context: "company",
          kind: "responsibility-adoption",
          id: command.props.commandId,
          version: command.props.snapshotDigest,
        },
      ],
      organizationUnits: [],
      unitPeriods: [],
      assignments: [],
      responsibilities: responsibilities.map((entry) => entry.period),
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
    const changes = command.toChanges(responsibilities.map((entry) => entry.resource))
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
    const insertedResources = new Set<string>()
    for (const entry of responsibilities) {
      if (!insertedResources.has(entry.resource.id)) {
        insertedResources.add(entry.resource.id)
        statements.push(
          database
            .prepare(`INSERT INTO company_responsibility_resource_bindings
        (resource_id, organization_id, employee_id, employment_id, organization_unit_id, responsibility_type, responsibility_id, authority_scope_id, resource_revision, recorded_at)
        VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2, ?3, ?4, ?5, ?6, ?7, ?9, ?8)`)
            .bind(
              entry.resource.id,
              entry.period.employeeId,
              entry.period.employmentId,
              entry.period.organizationUnitId,
              entry.period.responsibilityType,
              entry.resource.readText("responsibilityId"),
              entry.resource.readText("authorityScopeId"),
              command.props.recordedAt,
              entry.resource.revision,
            ),
        )
      }
      statements.push(
        database
          .prepare(
            `INSERT INTO company_responsibility_period_bindings (period_id, resource_id, period_revision, source_revision) VALUES (?1, ?2, ?3, ?4)`,
          )
          .bind(
            entry.period.periodId,
            entry.resource.id,
            entry.period.revision,
            entry.resource.revision,
          ),
      )
    }
    const organizationRevision = command.props.expectedRevision + changes.length
    statements.push(
      database
        .prepare(`INSERT INTO company_responsibility_resource_adoptions
      (command_id, operation_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, snapshot_digest, source_json, mappings_json, recorded_at, adopted_periods)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
        .bind(
          command.props.commandId,
          change.operationId,
          command.props.employeeId,
          fingerprint,
          command.props.actorAccountId,
          command.props.reason,
          command.props.expectedRevision,
          organizationRevision,
          command.props.observedOn,
          snapshot.props.digest,
          snapshot.props.sourceJson,
          JSON.stringify(command.props.mappings),
          command.props.recordedAt,
          responsibilities.length,
        ),
      completed,
    )
    const results = await database.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success))
      return this.unavailable(new Error("responsibility adoption batch did not succeed"))
    return {
      employeeId: command.props.employeeId,
      organizationRevision,
      adoptedPeriods: responsibilities.length,
      replayed: false,
    }
  }

  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<ResponsibilityResourceAdoptionResult | CompanyConflictError | null> {
    const row = await this.c.env.DB.prepare(
      `SELECT fingerprint, employee_id, organization_revision, adopted_periods FROM company_responsibility_resource_adoptions WHERE command_id = ?1`,
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
      "responsibility_resource_adoption_conflict",
    )
  }
  private invalid(cause: unknown): CompanyValidationError {
    return new CompanyValidationError(
      "責務の履歴・定義・対象組織と接続先を確認してください",
      "invalid_responsibility_adoption",
      { cause },
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "責務履歴の移行を安全に確定できません",
      "responsibility_resource_adoption_unavailable",
      { cause },
    )
  }
}
