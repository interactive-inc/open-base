import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** System Identity profile の email 更新statementを作る。 */
export class SystemIdentityProfileUpdateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(identityId: IdentityId, email: string, updatedAt: Date): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `UPDATE system_identity_profiles
       SET email = ?2, updated_at = max(updated_at + 1, ?3)
       WHERE identity_id = ?1`,
    ).bind(identityId, email, updatedAt.getTime())
  }
}
