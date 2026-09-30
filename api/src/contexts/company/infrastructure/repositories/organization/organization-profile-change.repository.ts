import { z } from "zod"
import type { OrganizationProfileChangeEntity } from "@/contexts/company/domain/entities/organization-profile-change.entity"
import {
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyValidationError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { D1OrganizationProfileAdapter } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"
import { CompanyResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { drizzle } from "drizzle-orm/d1"

type Context = D1Database
type Result = Readonly<{ organizationRevision: number; replayed: boolean }>
const receiptSchema = z.object({
  fingerprint: z.string().nullable(),
  organization_revision: z.number().int().positive().nullable(),
})

/** 表示した会社情報を再検査し、公開履歴・監査・変更前情報・再送結果を同時に保存する。 */
export class OrganizationProfileChangeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async change(command: OrganizationProfileChangeEntity): Promise<Result | CompanyOperationError> {
    const canonical = CanonicalSystemJsonValue.create({
      ...command.props,
      observedOn: null,
      recordedAt: null,
    })
    if (canonical instanceof Error) return this.unavailable(canonical)
    const fingerprint = await lifecycleSha256(canonical.toString())
    try {
      const previous = await this.replay(command, fingerprint)
      if (previous !== null) return previous
      const written = await this.persist(command, fingerprint, canonical.toString()).catch(
        (cause: unknown) => this.unavailable(cause),
      )
      if (!(written instanceof Error)) return written
      const raced = await this.replay(command, fingerprint)
      if (raced !== null) return raced
      const profile = await new D1OrganizationProfileAdapter(this.c).find(
        command.props.version.organizationId,
        command.props.version.effectiveOn,
      )
      if (
        !(profile instanceof Error) &&
        (profile === null ||
          profile.props.version.sourceFingerprint !== command.props.version.sourceFingerprint)
      )
        return this.conflict()
      return written
    } catch (cause) {
      return this.unavailable(cause)
    }
  }
  private async persist(
    command: OrganizationProfileChangeEntity,
    fingerprint: string,
    declaration: string,
  ): Promise<Result | CompanyOperationError> {
    const input = command.props
    if (input.observedOn !== input.version.effectiveOn) return this.conflict()
    const profiles = new D1OrganizationProfileAdapter(this.c)
    const profile = await profiles.find(input.version.organizationId, input.version.effectiveOn)
    if (profile instanceof Error) return this.unavailable(profile)
    if (
      profile === null ||
      profile.props.version.sourceFingerprint !== input.version.sourceFingerprint ||
      profile.props.version.organizationRevision !== input.version.organizationRevision ||
      profile.props.version.resourceId !== input.version.resourceId ||
      profile.props.version.resourceRevision !== input.version.resourceRevision ||
      profile.props.version.effectiveTo !== input.version.effectiveTo
    )
      return this.conflict()
    const change = command.toResourceChange()
    if (change instanceof Error)
      return new CompanyValidationError(
        "会社情報の変更が不正です",
        "invalid_organization_profile",
        { cause: change },
      )
    const journal = await new CompanyResourceJournalAdapter({
      d1: this.c,
      database: drizzle(this.c),
    }).prepare(change)
    if (journal instanceof Error) return this.unavailable(journal)
    const organizationRevision = input.version.organizationRevision + 1
    const statements = [
      profiles.prepareGuard(profile),
      ...journal.statements,
      this.c
        .prepare(`INSERT INTO company_profile_change_receipts
        (organization_id, command_id, fingerprint, actor_account_id, organization_revision, declaration_json, source_json, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
        .bind(
          input.version.organizationId,
          input.commandId,
          fingerprint,
          input.actorAccountId,
          organizationRevision,
          declaration,
          profile.props.sourceJson,
          input.recordedAt,
        ),
      journal.commit,
    ]
    const results = await this.c.batch(statements)
    if (results.length !== statements.length || results.some((result) => !result.success))
      return this.unavailable(new Error("company profile batch did not succeed"))
    return { organizationRevision, replayed: false }
  }
  private async replay(
    command: OrganizationProfileChangeEntity,
    fingerprint: string,
  ): Promise<Result | CompanyConflictError | null> {
    const row = await this.c
      .prepare(`SELECT profile.fingerprint, profile.organization_revision
      FROM company_command_receipts AS command
      LEFT JOIN company_profile_change_receipts AS profile
        ON profile.organization_id = command.organization_id AND profile.command_id = command.command_id
      WHERE command.organization_id = ?1 AND command.command_id = ?2`)
      .bind(command.props.version.organizationId, command.props.commandId)
      .first()
    if (row === null) return null
    const receipt = receiptSchema.parse(row)
    if (receipt.fingerprint !== fingerprint || receipt.organization_revision === null)
      return this.conflict()
    return { organizationRevision: receipt.organization_revision, replayed: true }
  }
  private conflict() {
    return new CompanyConflictError(
      "会社情報が変わっています。表示を更新して確認してください",
      "organization_profile_conflict",
    )
  }
  private unavailable(cause: unknown) {
    return new CompanyUnavailableError(
      "会社情報を保存できません",
      "organization_profile_unavailable",
      { cause },
    )
  }
}
