import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemStepUpGrantEntity } from "@system/domain/entities/system-step-up-grant.entity"

type Context = SystemD1Context

/** 短命な再認証grantをhashだけで保存し、Accountと期限へfail closedに束縛する。 */
export class SystemStepUpGrantRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async create(
    grant: SystemStepUpGrantEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | Error> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_step_up_grants
           SET revoked_at = ?2
           WHERE account_id = ?1 AND revoked_at IS NULL
             AND issued_at <= ?2 AND expires_at > ?2`,
        ).bind(grant.accountId, grant.issuedAt.getTime()),
        this.c.env.DB.prepare(
          `INSERT INTO system_step_up_grants
             (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL)`,
        ).bind(
          grant.id,
          grant.accountId,
          grant.tokenHash,
          grant.method,
          grant.issuedAt.getTime(),
          grant.expiresAt.getTime(),
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System step-up issuance batch did not succeed")
      }
      return "created"
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to issue System step-up grant")
    }
  }

  async use(accountId: AccountId, tokenHash: string, now: Date): Promise<boolean | Error> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_step_up_grants
           SET last_used_at = ?3
           WHERE account_id = ?1 AND token_hash = ?2
             AND issued_at <= ?3 AND expires_at > ?3 AND revoked_at IS NULL
             AND (last_used_at IS NULL OR last_used_at <= ?3)`,
        ).bind(accountId, tokenHash, now.getTime()),
        this.c.env.DB.prepare("SELECT changes() AS changed"),
      ]
      const results = await this.c.env.DB.batch<{ changed?: number }>(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System step-up use batch did not succeed")
      }
      return results[1]?.results?.[0]?.changed === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to use System step-up grant")
    }
  }
}
