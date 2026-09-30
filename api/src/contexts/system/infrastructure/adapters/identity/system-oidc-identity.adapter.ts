import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemDatabaseContext } from "@system/configuration/system-context"
import type { OidcIdentity } from "@system/application/auth/identity/lib/oidc-id-token-service"
import {
  systemAccounts,
  systemIdentityBindings,
  systemIdentityProfiles,
} from "@system/infrastructure/schema/system-core"
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm"
type Context = SystemDatabaseContext

/** active Accountと有効なIdentity profileからOIDC claimを解決する。 */
export class SystemOidcIdentityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByAccountId(accountId: AccountId): Promise<OidcIdentity | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          accountId: systemAccounts.id,
          accountStatus: systemAccounts.status,
          email: systemIdentityProfiles.email,
          emailVerified: systemIdentityProfiles.emailVerified,
        })
        .from(systemAccounts)
        .leftJoin(
          systemIdentityBindings,
          and(
            eq(systemIdentityBindings.accountId, systemAccounts.id),
            isNotNull(systemIdentityBindings.activatedAt),
            isNull(systemIdentityBindings.revokedAt),
          ),
        )
        .leftJoin(
          systemIdentityProfiles,
          eq(systemIdentityProfiles.identityId, systemIdentityBindings.id),
        )
        .where(eq(systemAccounts.id, accountId))
        .orderBy(
          desc(systemIdentityProfiles.emailVerified),
          desc(systemIdentityProfiles.lastUsedAt),
          asc(systemIdentityBindings.createdAt),
        )
        .limit(1)
      const row = rows.at(0)

      if (row === undefined || row.accountStatus !== "active") return null

      return Object.freeze({
        subject: row.accountId,
        email: row.email,
        emailVerified: row.emailVerified ?? false,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to resolve OIDC identity")
    }
  }
}
