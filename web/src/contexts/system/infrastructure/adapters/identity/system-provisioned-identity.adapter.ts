import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { z } from "zod"

const identity = z.object({
  identityId: zIdentityId,
  accountId: zAccountId,
  email: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
  activatedAt: z.number().int().nullable(),
  revokedAt: z.number().int().nullable(),
  accountStatus: z.string(),
  principalKind: z.string().nullable(),
})

export type SystemProvisionedIdentity = z.output<typeof identity>
type Context = SystemD1Context

/** 外部identityの現在版を読み、失効と同時更新を検査したprofile変更を準備する。 */
export class SystemProvisionedIdentityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(provider: string, subject: string): Promise<SystemProvisionedIdentity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(`SELECT binding.id AS identityId,
        binding.account_id AS accountId, profile.email, profile.updated_at AS updatedAt,
        binding.activated_at AS activatedAt, binding.revoked_at AS revokedAt,
        account.status AS accountStatus, principal.kind AS principalKind
        FROM system_identity_bindings binding
        JOIN system_identity_profiles profile ON profile.identity_id = binding.id
        JOIN system_accounts account ON account.id = binding.account_id
        LEFT JOIN system_principals principal ON principal.account_id = account.id
        WHERE binding.provider = ?1 AND binding.subject = ?2`)
        .bind(provider, subject)
        .first()
      if (row === null) return null
      const parsed = identity.safeParse(row)
      return parsed.success
        ? parsed.data
        : new Error("invalid provisioned identity", { cause: parsed.error })
    } catch (cause) {
      return new Error("failed to read provisioned identity", { cause })
    }
  }

  prepareUpdate(
    input: Readonly<{
      current: SystemProvisionedIdentity
      email: string
      now: Date
    }>,
  ): ReadonlyArray<D1PreparedStatement> {
    return [
      this.c.env.DB.prepare(`UPDATE system_identity_profiles
      SET email = ?2, updated_at = max(updated_at + 1, ?3)
      WHERE identity_id = ?1 AND updated_at = ?4
        AND EXISTS (
          SELECT 1 FROM system_identity_bindings binding
          JOIN system_accounts account ON account.id = binding.account_id
          LEFT JOIN system_principals principal ON principal.account_id = account.id
          WHERE binding.id = ?1 AND account.id = ?5 AND account.status = 'active'
            AND binding.activated_at <= ?3 AND binding.revoked_at IS NULL
            AND (principal.id IS NULL OR principal.kind = 'human')
        )`).bind(
        input.current.identityId,
        input.email,
        input.now.getTime(),
        input.current.updatedAt,
        input.current.accountId,
      ),
      this.c.env.DB.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
    ]
  }

  prepareTargetGuard(accountId: AccountId, tokenVersion: number): D1PreparedStatement {
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_accounts account
      LEFT JOIN system_principals principal ON principal.account_id = account.id
      WHERE account.id = ?1 AND account.status = 'active' AND account.token_version = ?2
        AND (principal.id IS NULL OR principal.kind = 'human')
    ) THEN 1 ELSE json_extract('', '$') END AS ok`).bind(accountId, tokenVersion)
  }
}
