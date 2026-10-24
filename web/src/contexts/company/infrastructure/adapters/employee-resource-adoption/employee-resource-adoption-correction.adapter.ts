import type { EmployeeResourceAdoptionConfirmation } from "@/contexts/company/domain/values/employee-resource-adoption-correction.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = D1Database

/** 各対象の訂正版を順番に追記し、元の版を更新せず公開headを進める。 */
export class EmployeeResourceAdoptionCorrectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    props: Readonly<{
      confirmed: ReadonlyArray<EmployeeResourceAdoptionConfirmation>
      commandId: string
      partCommandPrefix: string
      organizationRevision: number
    }>,
  ): ReadonlyArray<D1PreparedStatement> | CompanyValidationError {
    const statements: D1PreparedStatement[] = []
    const maximum = Math.max(0, ...props.confirmed.map((entry) => entry.corrections.length))
    for (const index of Array.from({ length: maximum }, (_, offset) => offset)) {
      const rows: string[] = []
      for (const entry of props.confirmed) {
        const resource = entry.corrections[index]
        if (resource === undefined) continue
        const attributes = CanonicalSystemJsonValue.create(resource.attributes)
        if (attributes instanceof Error) return this.invalid()
        rows.push(
          JSON.stringify({
            type: resource.type,
            id: resource.id,
            revision: resource.revision,
            state: resource.state,
            effectiveFrom: resource.effectiveFrom,
            effectiveTo: resource.effectiveTo,
            attributesJson: attributes.toString(),
            actorAccountId: entry.command.props.actorAccountId,
            reason: entry.command.props.reason,
            recordedAt: entry.command.props.recordedAt,
          }),
        )
      }
      const payload = `[${rows.join(",")}]`
      if (new TextEncoder().encode(payload).length > 1_750_000) return this.invalid()
      statements.push(
        this.c
          .prepare(`INSERT INTO company_resource_revisions
          (organization_id, resource_type, resource_id, revision, organization_revision,
           state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
          SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', json_extract(value, '$.type'), json_extract(value, '$.id'),
            json_extract(value, '$.revision'), ?2, json_extract(value, '$.state'),
            json_extract(value, '$.effectiveFrom'), json_extract(value, '$.effectiveTo'),
            json_extract(value, '$.attributesJson'), ?3, json_extract(value, '$.actorAccountId'),
            json_extract(value, '$.reason'), json_extract(value, '$.recordedAt')
          FROM json_each(?1)`)
          .bind(
            payload,
            props.organizationRevision + index,
            index === 0 ? props.commandId : `${props.partCommandPrefix}:${index}`,
          ),
        this.c
          .prepare(`INSERT INTO company_resource_heads
          (organization_id, resource_type, resource_id, revision, organization_revision,
           state, effective_from, effective_to, attributes_json, updated_at)
          SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', json_extract(value, '$.type'), json_extract(value, '$.id'),
            json_extract(value, '$.revision'), ?2, json_extract(value, '$.state'),
            json_extract(value, '$.effectiveFrom'), json_extract(value, '$.effectiveTo'),
            json_extract(value, '$.attributesJson'), json_extract(value, '$.recordedAt')
          FROM json_each(?1) WHERE true
          ON CONFLICT (organization_id, resource_type, resource_id) DO UPDATE SET
            revision = excluded.revision, organization_revision = excluded.organization_revision,
            state = excluded.state, effective_from = excluded.effective_from,
            effective_to = excluded.effective_to, attributes_json = excluded.attributes_json,
            updated_at = excluded.updated_at`)
          .bind(payload, props.organizationRevision + index),
      )
    }
    if (statements.length > 40) return this.invalid()
    return statements
  }

  private invalid() {
    return new CompanyValidationError(
      "一括接続の訂正履歴が大きすぎるか不正です",
      "employee_resource_adoption_batch_too_large",
    )
  }
}
