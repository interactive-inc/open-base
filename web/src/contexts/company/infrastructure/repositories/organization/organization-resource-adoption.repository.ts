import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import type { OrganizationResourceAdoptionEntity } from "@/contexts/company/domain/entities/organization-resource-adoption.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import type { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { OrganizationUnitChangeStatementAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-unit-change-statement.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
export type OrganizationResourceAdoptionResult = Readonly<{
  organizationUnitId: string
  organizationRevision: number
  replayed: boolean
}>
const receiptSchema = z.object({
  fingerprint: z.string(),
  organization_unit_id: z.string(),
  organization_revision: z.number().int().positive(),
})

/** 元の組織履歴を変更せず、公開履歴・対応・移行証跡を原子的に確定する。 */
export class OrganizationResourceAdoptionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async adopt(
    command: OrganizationResourceAdoptionEntity,
  ): Promise<OrganizationResourceAdoptionResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({ ...command.props, recordedAt: null })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const snapshot = await new OrganizationResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.organizationUnitId,
      )
      if (snapshot instanceof Error) return this.unavailable(snapshot)
      if (snapshot === null)
        return new CompanyNotFoundError("組織が見つかりません", "organization_unit_not_found")
      const applied = await this.apply(command, fingerprint, snapshot).catch((cause: unknown) =>
        this.unavailable(cause),
      )
      if (!(applied instanceof Error)) return applied
      const raced = await this.replay(command.props.commandId, fingerprint)
      if (raced !== null) return raced
      const current = await new OrganizationResourceAdoptionSnapshotAdapter(this.c.env.DB).find(
        command.props.organizationUnitId,
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
    command: OrganizationResourceAdoptionEntity,
    fingerprint: string,
    snapshot: OrganizationResourceAdoptionSnapshotValue,
  ): Promise<OrganizationResourceAdoptionResult | CompanyOperationError> {
    const today = resolveCompanyBusinessDate({
      now: new Date(command.props.recordedAt).toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (today instanceof Error) return this.unavailable(today)
    if (today !== command.props.observedOn) return this.conflict()
    const snapshots = new OrganizationResourceAdoptionSnapshotAdapter(this.c.env.DB)
    const changes = command.toChanges(snapshot)
    if (changes instanceof Error) return changes
    if (await this.hasResources(command.props.organizationUnitId, changes)) return this.conflict()
    const repository = new D1CompanyResourceRepository({ database: this.c.env.DB })
    const current = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["organization-unit"],
    })
    if (!current.ok) return this.unavailable(current.cause)
    if (current.organizationRevision !== command.props.expectedRevision) return this.conflict()
    const latest = changes
      .flatMap((change) => change.resources)
      .filter(
        (resource) =>
          !changes.some((change) =>
            change.resources.some(
              (next) => next.id === resource.id && next.revision > resource.revision,
            ),
          ),
      )
    const validationChange = CompanyResourceChangeEntity.create({
      commandId: command.props.commandId,
      expectedRevision: command.props.expectedRevision,
      actorAccountId: command.props.actorAccountId,
      recordedAt: command.props.recordedAt,
      reason: command.props.reason,
      resources: latest,
    })
    if (validationChange instanceof Error)
      return new CompanyValidationError("組織履歴が不正です", "invalid_organization_adoption", {
        cause: validationChange,
      })
    const reportingHistory = await repository.findReportingRelationHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      current.organizationRevision,
    )
    if (reportingHistory instanceof Error) return this.unavailable(reportingHistory)
    const invalid = validateCompanyOrganizationChange(
      current.resources,
      validationChange,
      reportingHistory,
    )
    if (invalid !== null)
      return new CompanyValidationError(
        "先に親組織の履歴を接続し、期間と階層を確認してください",
        "invalid_organization_adoption",
        { cause: invalid },
      )
    const statements: D1PreparedStatement[] = [snapshots.prepareGuard(snapshot)]
    if (command.props.initializationConfirmation !== undefined) {
      const confirmed = latest[0]?.toOrganizationUnitPeriod()
      if (confirmed === null || confirmed === undefined)
        return this.unavailable("missing confirmed period")
      const operationKey = `org-confirm:${fingerprint}`
      const operationId = restoreWorkforceId("personnel_action", companyOperationId(operationKey))
      const correction = OrganizationWorkforceChangeEntity.restore({
        operationId,
        operationKey,
        expectedRevision: snapshot.props.value.lifecycleRevision,
        asOf: restoreCalendarDate(command.props.observedOn),
        recordedAt: command.props.recordedAt,
        actorAccountId: command.props.actorAccountId,
        reason: command.props.reason,
        evidenceReferences: command.props.initializationConfirmation.evidenceReferences,
        organizationUnits: [],
        unitPeriods: [
          { ...confirmed, recordedByActionId: operationId, recordedAt: command.props.recordedAt },
        ],
        assignments: [],
        responsibilities: [],
      })
      if (correction instanceof Error) return this.unavailable(correction)
      statements.push(
        ...new OrganizationUnitChangeStatementAdapter(this.c.env.DB).prepare(
          correction,
          fingerprint,
        ),
      )
    }
    const journal = new CompanyResourceJournalAdapter({
      database: drizzle(this.c.env.DB),
      d1: this.c.env.DB,
    })
    for (const change of changes) {
      const prepared = await journal.prepare(change)
      if (prepared instanceof Error) return this.unavailable(prepared)
      statements.push(...prepared.statements, prepared.commit)
    }
    statements.push(
      this.c.env.DB.prepare(`INSERT INTO company_organization_resource_bindings
      (organization_unit_id, organization_id, recorded_at) VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2)`).bind(
        command.props.organizationUnitId,
        command.props.recordedAt,
      ),
    )
    const organizationRevision = command.props.expectedRevision + changes.length
    statements.push(
      this.c.env.DB.prepare(`INSERT INTO company_organization_resource_adoptions
      (command_id, organization_unit_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision,
       observed_on, snapshot_digest, source_json, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`).bind(
        command.props.commandId,
        command.props.organizationUnitId,
        fingerprint,
        command.props.actorAccountId,
        command.props.reason,
        command.props.expectedRevision,
        organizationRevision,
        command.props.observedOn,
        snapshot.props.digest,
        snapshot.props.sourceJson,
        command.props.recordedAt,
      ),
    )
    await this.c.env.DB.batch(statements)
    return {
      organizationUnitId: command.props.organizationUnitId,
      organizationRevision,
      replayed: false,
    }
  }
  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<OrganizationResourceAdoptionResult | CompanyConflictError | null> {
    const row = await this.c.env.DB.prepare(
      `SELECT fingerprint, organization_unit_id, organization_revision FROM company_organization_resource_adoptions WHERE command_id = ?1`,
    )
      .bind(commandId)
      .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint) return this.conflict()
    return {
      organizationUnitId: receipt.organization_unit_id,
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }
  private async hasResources(
    organizationUnitId: string,
    changes: ReadonlyArray<CompanyResourceChangeEntity>,
  ): Promise<boolean> {
    return (
      (await this.c.env.DB.prepare(`SELECT 1 FROM company_resource_heads WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'organization-unit'
      AND (json_extract(attributes_json, '$.organizationUnitId') = ?1 OR resource_id IN (SELECT value FROM json_each(?2))) LIMIT 1`)
        .bind(
          organizationUnitId,
          JSON.stringify(
            changes.flatMap((change) => change.resources.map((resource) => resource.id)),
          ),
        )
        .first()) !== null
    )
  }
  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "移行対象または依頼が変更されています。再確認してください",
      "organization_resource_adoption_conflict",
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "組織履歴を接続できませんでした",
      "organization_resource_adoption_unavailable",
      { cause },
    )
  }
}
