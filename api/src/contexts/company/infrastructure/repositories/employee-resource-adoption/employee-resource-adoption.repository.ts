import type { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import type { EmployeeResourceAdoptionEntity } from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{ env: Readonly<{ DB: D1Database; COMPANY_TIME_ZONE?: string }> }>
export type EmployeeResourceAdoptionResult = Readonly<{
  employeeId: string
  organizationRevision: number
  replayed: boolean
}>
const receiptSchema = z.object({
  fingerprint: z.string(),
  employee_id: z.string(),
  organization_revision: z.number().int().positive(),
})

/** 元の台帳を変更せず、確認履歴・接続・移行証跡を一つのtransactionで保存する。 */
export class EmployeeResourceAdoptionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async adopt(
    command: EmployeeResourceAdoptionEntity,
  ): Promise<EmployeeResourceAdoptionResult | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({
      ...command.props,
      recordedAt: null,
      resources: command.props.resources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: resource.effectiveFrom,
        effectiveTo: resource.effectiveTo,
        attributes: resource.attributes,
      })),
    })
    if (canonical instanceof Error) return this.unavailable(canonical)
    if (new TextEncoder().encode(canonical.toString()).length > 750_000)
      return new CompanyValidationError(
        "確認履歴が大きすぎます",
        "employee_resource_adoption_too_large",
      )
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return this.unavailable(digest)
    const fingerprint = digest.toString()
    const snapshots = new EmployeeResourceAdoptionSnapshotAdapter(this.c.env.DB)
    try {
      const replay = await this.replay(command.props.commandId, fingerprint)
      if (replay !== null) return replay
      const today = resolveCompanyBusinessDate({
        now: new Date(command.props.recordedAt).toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (today instanceof Error) return this.unavailable(today)
      if (today !== command.props.observedOn) return this.conflict()
      const snapshot = await snapshots.find(command.props.employeeId)
      if (snapshot instanceof Error) return this.unavailable(snapshot)
      if (snapshot === null)
        return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")
      const validation = command.validate(snapshot)
      if (validation !== null) return validation
      if (command.props.reuseExistingHistory)
        return await this.connectExisting(command, snapshot, fingerprint)
      if (await this.hasResources(command)) return this.conflict()
      const changes = command.toChanges()
      if (changes instanceof Error) return this.unavailable(changes)
      const statements: D1PreparedStatement[] = [snapshots.prepareGuard(snapshot)]
      const journal = new CompanyResourceJournalAdapter({
        database: drizzle(this.c.env.DB),
        d1: this.c.env.DB,
      })
      for (const [index, change] of changes.entries()) {
        const prepared = await journal.prepare(change)
        if (prepared instanceof Error) return this.unavailable(prepared)
        statements.push(...prepared.statements)
        if (index === changes.length - 1)
          statements.push(...this.prepareBindings(command, snapshot))
        statements.push(prepared.commit)
      }
      const organizationRevision = command.props.expectedRevision + changes.length
      statements.push(this.prepareReceipt({ command, snapshot, fingerprint, organizationRevision }))
      await this.c.env.DB.batch(statements)
      return { employeeId: command.props.employeeId, organizationRevision, replayed: false }
    } catch (cause) {
      try {
        const replay = await this.replay(command.props.commandId, fingerprint)
        if (replay !== null) return replay
        const current = await snapshots.find(command.props.employeeId)
        if (
          current === null ||
          (!(current instanceof Error) && current.props.digest !== command.props.snapshotDigest) ||
          (!command.props.reuseExistingHistory && (await this.hasResources(command)))
        )
          return this.conflict()
      } catch {
        return this.unavailable(cause)
      }
      return this.unavailable(cause)
    }
  }

  private async connectExisting(
    command: EmployeeResourceAdoptionEntity,
    snapshot: EmployeeResourceAdoptionSnapshotValue,
    fingerprint: string,
  ): Promise<EmployeeResourceAdoptionResult> {
    const organizationRevision = command.props.expectedRevision + 1
    await this.c.env.DB.batch([
      new EmployeeResourceAdoptionSnapshotAdapter(this.c.env.DB).prepareGuard(snapshot),
      this.c.env.DB.prepare(`INSERT INTO company_command_receipts
        (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
        VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, ?3, ?4, ?5)`).bind(
        `employee-connection:${fingerprint}`,
        fingerprint,
        command.props.expectedRevision,
        organizationRevision,
        command.props.recordedAt,
      ),
      ...this.prepareBindings(command, snapshot),
      this.c.env.DB.prepare(`UPDATE company_organizations SET revision = ?1, updated_at = ?2
        WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND revision = ?3`).bind(
        organizationRevision,
        command.props.recordedAt,
        command.props.expectedRevision,
      ),
      this.c.env.DB.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END"),
      this.prepareReceipt({ command, snapshot, fingerprint, organizationRevision }),
    ])
    return { employeeId: command.props.employeeId, organizationRevision, replayed: false }
  }

  private prepareBindings(
    command: EmployeeResourceAdoptionEntity,
    snapshot: EmployeeResourceAdoptionSnapshotValue,
  ): ReadonlyArray<D1PreparedStatement> {
    return command.props.resources
      .filter(
        (resource) =>
          resource.type !== "person" &&
          !command.props.resources.some(
            (newer) =>
              newer.type === resource.type &&
              newer.id === resource.id &&
              newer.revision > resource.revision,
          ),
      )
      .map((resource) =>
        this.c.env.DB.prepare(`INSERT INTO company_workforce_resource_bindings
      (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
      VALUES (?1, ?2, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?3, ?4, ?5, NULL)`).bind(
          resource.type,
          resource.id,
          command.props.employeeId,
          resource.revision,
          snapshot.props.value.lifecycleRevision,
        ),
      )
  }

  private prepareReceipt(
    props: Readonly<{
      command: EmployeeResourceAdoptionEntity
      snapshot: EmployeeResourceAdoptionSnapshotValue
      fingerprint: string
      organizationRevision: number
    }>,
  ): D1PreparedStatement {
    return this.c.env.DB.prepare(`INSERT INTO company_employee_resource_adoptions
      (command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision,
       observed_on, snapshot_digest, source_json, recorded_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`).bind(
      props.command.props.commandId,
      props.command.props.employeeId,
      props.fingerprint,
      props.command.props.actorAccountId,
      props.command.props.reason,
      props.command.props.expectedRevision,
      props.organizationRevision,
      props.command.props.observedOn,
      props.snapshot.props.digest,
      props.snapshot.props.sourceJson,
      props.command.props.recordedAt,
    )
  }

  private async replay(
    commandId: string,
    fingerprint: string,
  ): Promise<EmployeeResourceAdoptionResult | CompanyConflictError | null> {
    const row = await this.c.env.DB.prepare(`SELECT fingerprint, employee_id, organization_revision
      FROM company_employee_resource_adoptions WHERE command_id = ?1`)
      .bind(commandId)
      .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint) return this.conflict()
    return {
      employeeId: receipt.employee_id,
      organizationRevision: receipt.organization_revision,
      replayed: true,
    }
  }

  private async hasResources(command: EmployeeResourceAdoptionEntity): Promise<boolean> {
    const keys = command.props.resources
      .filter((resource) => resource.revision === 1)
      .map((resource) => ({ type: resource.type, id: resource.id }))
    return (
      (await this.c.env.DB.prepare(`SELECT 1 AS present FROM company_resource_heads AS head
      JOIN json_each(?1) AS requested ON head.resource_type = json_extract(requested.value, '$.type')
        AND head.resource_id = json_extract(requested.value, '$.id')
      WHERE head.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' LIMIT 1`)
        .bind(JSON.stringify(keys))
        .first()) !== null
    )
  }

  private conflict(): CompanyConflictError {
    return new CompanyConflictError(
      "移行対象または依頼が変更されています。再確認してください",
      "employee_resource_adoption_conflict",
    )
  }
  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "移行を保存できませんでした",
      "employee_resource_adoption_unavailable",
      { cause },
    )
  }
}
