import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{ database: D1Database }>

/**
 * 実行者が対象Accountにログイン方法を足してよい条件。足したログイン方法で対象の権限を
 * 得られるため、本人、全社範囲でsystem:adminを持つ実行者、または全社範囲でiam:writeを持ち
 * 対象の取り消されていない権限をすべて全社範囲で持つ実行者だけを通す。
 * 新しいAccountへ付けるroleを実行者の権限内に限る規則と対称にする。
 */
const ACTOR_COVERS_ACCOUNT_SQL = `WITH actor_permissions AS (
   SELECT DISTINCT permission.permission_key AS key
   FROM system_accounts account
   INNER JOIN system_role_bindings binding ON binding.account_id = account.id
   INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
   WHERE account.id = ?1
     AND account.status = 'active'
     AND binding.resource_type IS NULL
     AND binding.revoked_at IS NULL
 ), target_permissions AS (
   SELECT DISTINCT permission.permission_key AS key
   FROM system_role_bindings binding
   INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
   WHERE binding.account_id = ?2 AND binding.revoked_at IS NULL
 )
 SELECT CASE WHEN
   ?1 = ?2
   OR EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
   OR (
     EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
     AND NOT EXISTS (
       SELECT 1 FROM target_permissions target
       WHERE NOT EXISTS (
         SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
       )
     )
   )`

/** 他人のAccountへログイン方法を足す操作で、実行者が対象の権限を覆うことを確かめる。 */
export class SystemActorAccountCoverageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 変更と同じbatchで条件を確かめ直す文。満たさなければinteger overflowでbatchごと止める。 */
  prepare(actorAccountId: AccountId, targetAccountId: AccountId): D1PreparedStatement {
    return this.c.database
      .prepare(`${ACTOR_COVERS_ACCOUNT_SQL}\n THEN 1 ELSE abs(-9223372036854775808) END AS ok`)
      .bind(actorAccountId, targetAccountId)
  }

  /** 書き込みの前に条件を読み、満たさない要求を拒否として返せるようにする。 */
  async check(actorAccountId: AccountId, targetAccountId: AccountId): Promise<boolean | Error> {
    try {
      const covered = await this.c.database
        .prepare(`${ACTOR_COVERS_ACCOUNT_SQL}\n THEN 1 ELSE 0 END AS ok`)
        .bind(actorAccountId, targetAccountId)
        .first<number>("ok")
      return covered === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to check System Account coverage")
    }
  }
}
