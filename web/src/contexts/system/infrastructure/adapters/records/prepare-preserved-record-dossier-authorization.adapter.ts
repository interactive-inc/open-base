import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemAuditDisclosureReadAdapter } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"

type Context = SystemD1Context &
  Readonly<{
    authentication: SystemReadAuthentication
    purpose: string
  }>

/** 原文出力・承認履歴・人の保全参照・目的付き監査出力の資格を同時に要求する。 */
export class PreparePreservedRecordDossierAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(at: Date) {
    const authentication = this.c.authentication
    const read = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(authentication, at)
    if (read instanceof Error) return read
    if (
      read === null ||
      !read.permissionKeys.has(SystemFeaturePermission.RECORD_EXPORT.key) ||
      !read.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ.key)
    )
      return new PreservedRecordDisclosureDeniedError()
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      permissions: ["system:admin"],
      now: at,
    })
    if (human instanceof Error) return human
    if (human === "forbidden") return new PreservedRecordDisclosureDeniedError()
    const audit = await new SystemAuditDisclosureReadAdapter(this.c).prepare({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      permission: SystemFeaturePermission.AUDIT_EXPORT.key,
      purpose: this.c.purpose,
      now: at,
    })
    if (audit instanceof Error) {
      if (audit.kind === "forbidden") return new PreservedRecordDisclosureDeniedError()
      return audit
    }
    return Object.freeze({
      permissionKeys: read.permissionKeys,
      auditDisclosure: audit,
      assertions: (now: Date) => {
        const assertions = read.assertions(now)
        if (assertions instanceof Error) return assertions
        return [
          ...assertions,
          ...human.assertions,
          ...audit.assertions,
          this.c.env.DB.prepare(`WITH evaluation AS (
            SELECT max(?2, CAST(round((julianday('now') - 2440587.5) * 86400000) AS INTEGER)) AS at
          ) SELECT CASE WHEN NOT EXISTS (
            SELECT 1 FROM system_audit_disclosure_policy_revisions p
            JOIN system_audit_events a ON a.event_id = p.audit_event_id
            WHERE p.scope IN ('*', ?1) AND p.revision = (
              SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions latest WHERE latest.scope = p.scope
            ) AND json_extract(a.after_json, '$.enabled') = 1
              AND json_extract(a.after_json, '$.expiresAt') IS NOT NULL
              AND round((julianday(json_extract(a.after_json, '$.expiresAt')) - 2440587.5) * 86400000) <= (SELECT at FROM evaluation)
          ) THEN 1 ELSE json_extract('{}', 'record_dossier_audit_disclosure_expired') END`).bind(
            authentication.accountId,
            now.getTime(),
          ),
        ]
      },
    })
  }
}
