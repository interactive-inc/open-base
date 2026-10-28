import { app } from "@/api/app"
import { SystemSignedInSessionChannel } from "@system/interface/request-environment/system-signed-in-session-channel"
import { reviewFixture } from "@/contexts/performance-review/test/review-fixture.test-support"

/** 実際の認証middlewareと評価routeへ、検証済みの人のサインインを渡す。 */
export async function reviewHttpFixture() {
  const fixture = await reviewFixture()
  const env = {
    ...fixture.context(0).env,
    JWT_SECRET: "review-test-signing-secret-value",
    AUDIT_HMAC_SECRET: "review-test-audit-secret-value",
    SIGN_IN_METHOD: "oidc",
    IDENTITY_ISSUER: "https://identity.example.com",
    OIDC_CLIENT_ID: "review-test",
    CORS_ORIGIN: undefined,
  }
  const call = (index: number | null, path: string, init?: RequestInit, overrides = {}) => {
    const person = index === null ? undefined : fixture.people[index]
    const bindings =
      person === undefined
        ? { ...env, ...overrides }
        : new SystemSignedInSessionChannel({ env: { ...env, ...overrides } }).attach({
            accountId: person.accountId,
            sessionId: crypto.randomUUID(),
            authenticatedAt: fixture.at,
            createdAt: fixture.at,
            expiresAt: new Date(Date.now() + 86400000),
            method: "oidc",
            accountTokenVersion: 0,
          })
    return app.request(path, init, bindings)
  }
  return { ...fixture, env, call }
}
