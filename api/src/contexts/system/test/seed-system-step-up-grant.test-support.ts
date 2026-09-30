import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import type { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

/** HTTP testで明示的なstep-up境界を通すための短命grantをseedする。 */
export async function seedSystemStepUpGrant(
  fixture: Pick<SystemSessionTestContext, "database">,
  accountId: AccountId,
  now: Date,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accountId))
  const rawToken = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  const tokenHash = await new SystemPrincipalSecretService().hashRawSecret(rawToken)
  if (tokenHash instanceof Error) throw tokenHash
  // grant id は UUID の CHECK があるため、Account ごとに決まる UUID を digest から作る。
  const grantId = `${rawToken.slice(0, 8)}-${rawToken.slice(8, 12)}-4${rawToken.slice(13, 16)}-8${rawToken.slice(17, 20)}-${rawToken.slice(20, 32)}`
  await fixture.database
    .prepare(`INSERT INTO system_step_up_grants
         (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
       VALUES (?1, ?2, ?3, 'password', ?4, ?5, NULL, NULL)`)
    .bind(grantId, accountId, tokenHash, now.getTime(), now.getTime() + 300_000)
    .run()
  return rawToken
}
