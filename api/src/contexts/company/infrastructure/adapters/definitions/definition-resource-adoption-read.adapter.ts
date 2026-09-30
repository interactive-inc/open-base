import { z } from "zod"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{ env: Readonly<{ DB: D1Database }> }>

/** 旧台帳撤去後も、確定済みの定義移行証跡を原文とともに取得する。 */
export class DefinitionResourceAdoptionReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(commandId: string) {
    try {
      const row = await this.c.env.DB.prepare(`SELECT command_id, resource_type, resource_id,
        definition_id, actor_account_id, reason, organization_revision, observed_on,
        snapshot_digest, source_json, recorded_at FROM company_definition_resource_adoptions
        WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND command_id = ?1`)
        .bind(commandId)
        .first()
      if (row === null) return null
      const record = z
        .object({
          command_id: z.string(),
          resource_type: z.enum(["grade", "position"]),
          resource_id: z.string(),
          definition_id: z.number().int().positive(),
          actor_account_id: z.string(),
          reason: z.string(),
          organization_revision: z.number().int().positive(),
          observed_on: z.string().date(),
          snapshot_digest: z.string(),
          source_json: z.string(),
          recorded_at: z.number().int().nonnegative(),
        })
        .parse(row)
      const source = await DefinitionResourceAdoptionSnapshotValue.create(record.source_json)
      if (source instanceof Error) return this.unavailable(source)
      if (source.props.digest !== record.snapshot_digest)
        return this.unavailable(new Error("definition adoption evidence digest mismatch"))
      return {
        commandId: record.command_id,
        type: record.resource_type,
        resourceId: record.resource_id,
        definitionId: record.definition_id,
        actorAccountId: record.actor_account_id,
        reason: record.reason,
        organizationRevision: record.organization_revision,
        observedOn: record.observed_on,
        recordedAt: record.recorded_at,
        snapshotDigest: record.snapshot_digest,
        source: source.props.value,
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private unavailable(cause: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "定義の移行証跡を取得できませんでした",
      "definition_resource_adoption_unavailable",
      { cause },
    )
  }
}
