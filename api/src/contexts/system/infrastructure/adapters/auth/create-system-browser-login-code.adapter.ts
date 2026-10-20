import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/**
 * コードの発行を要求した認証。保存の時点でもAccountの世代と発行元が有効なことを照合し、
 * token versionとSession familyはcodeへ束縛して交換時にも照合する。
 */
type Origin = Readonly<{
  accountId: AccountId
  tokenVersion: number
  sessionFamilyId: SessionFamilyId | null
  machineCredentialId: string | null
  identityBindingId: string | null
}>

export type SystemBrowserLoginCodeCreation = "created" | "rejected"

/**
 * 発行要求の認証がまだ有効なときだけコードを保存する。
 * Account が有効で token version が入口で受け付けた値のまま、かつ発行元（Session family・
 * 機械credential・外部Identity）が失効していないことを INSERT の条件にする。
 * 失効は発行処理が取った時刻ではなく保存の時点の行で判定する。時刻を取った後に完了した
 * ログアウトは、それより後の時刻を刻むため、時刻との比較では見逃す。
 */
const insertSql = `INSERT INTO system_browser_login_codes
    (code_hash, account_id, token_version, session_family_id, created_at, expires_at)
  SELECT ?1, account.id, ?5, ?6, ?3, ?4
  FROM system_accounts account
  WHERE account.id = ?2
    AND account.status = 'active'
    AND account.closed_at IS NULL
    AND account.token_version = ?5
    AND (?6 IS NULL OR EXISTS (
      SELECT 1 FROM system_sessions session
      WHERE session.family_id = ?6
        AND session.account_id = account.id
        AND session.revoked_at IS NULL
    ))
    AND (?7 IS NULL OR EXISTS (
      SELECT 1 FROM system_principals principal
      INNER JOIN system_machine_credentials credential ON credential.principal_id = principal.id
      WHERE principal.account_id = account.id
        AND credential.id = ?7
        AND credential.status = 'active'
        AND credential.revoked_at IS NULL
        AND (credential.expires_at IS NULL OR credential.expires_at > ?3)
    ))
    AND (?8 IS NULL OR EXISTS (
      SELECT 1 FROM system_identity_bindings identity
      WHERE identity.id = ?8
        AND identity.account_id = account.id
        AND identity.activated_at IS NOT NULL
        AND identity.revoked_at IS NULL
    ))`

/** browser token交換用codeのhashとAccount、発行元credentialの束縛を短期間保存し、発行監査と同じbatchで確定する。 */
export class CreateSystemBrowserLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createSystemBrowserLoginCode(
    input: Readonly<{
      codeHash: string
      origin: Origin
      createdAt: Date
      expiresAt: Date
    }>,
  ): Promise<SystemBrowserLoginCodeCreation | Error> {
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.origin.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authBrowserLoginCodeCreated,
      targetType: "account",
      targetId: input.origin.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: input.createdAt,
    })
    if (audit instanceof Error) return audit

    try {
      const database = this.c.env.DB
      const statements = [
        database
          .prepare(insertSql)
          .bind(
            input.codeHash,
            input.origin.accountId,
            input.createdAt.getTime(),
            input.expiresAt.getTime(),
            input.origin.tokenVersion,
            input.origin.sessionFamilyId,
            input.origin.machineCredentialId,
            input.origin.identityBindingId,
          ),
        // 認証が失効していれば batch ごと取り消し、コードも成功監査も残さない。
        database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ]
      const results = await database.batch(statements)

      return results.length === statements.length && results.every((result) => result.success)
        ? "created"
        : new Error("System browser login code creation did not succeed")
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("malformed JSON")) return "rejected"

      return caught instanceof Error
        ? caught
        : new Error("failed to create System browser login code")
    }
  }
}
