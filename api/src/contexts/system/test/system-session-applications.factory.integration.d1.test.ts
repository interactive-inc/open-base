import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  createSystemSessionApplications,
  type SystemSessionApplications,
} from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("1902ea86-de46-444b-9896-a4308a8781fb")
const issuedAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const revokedAt = new Date("2026-01-02T00:00:01.000Z")
const sessionTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000
const jwtSecret = "system-session-factory-test-secret"
const auditContext = Object.freeze({
  authorizationJson: '{"permission":"auth:session"}',
  metadataJson: '{"client":"factory-test"}',
})

async function insertAccount(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, issuedAt.getTime())
    .run()
}

function requireApplications(fixture: SystemSessionTestContext): SystemSessionApplications {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds,
  })

  if (applications instanceof Error) throw applications

  return applications
}

/** SystemのcompositionがApplication・Domain・D1 adapterを欠落なく接続することを横断検証する。 */
describe("createSystemSessionApplications", () => {
  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "不正なSession lifetime %pを配線前に拒否する",
    async (invalidLifetime) => {
      const fixture = await SystemSessionTestContext.create()

      expect(
        createSystemSessionApplications({
          context: fixture.context,
          jwtSecret,
          sessionTtlMilliseconds: invalidLifetime,
        }),
      ).toEqual(new Error("System Session lifetime is invalid"))
    },
  )

  test("同じ安全な依存で発行・検証・rotation・失効を完結する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const applications = requireApplications(fixture)

    expect(Object.isFrozen(applications)).toBe(true)

    const issued = await applications.issue.execute({
      accountId,
      tokenVersion: 0,
      now: issuedAt,
      auditContext,
    })
    if (issued instanceof Error || issued.kind !== "issued") {
      throw new Error("expected System Session issuance")
    }

    expect(
      await applications.authenticate.execute({ rawToken: issued.rawToken, now: issuedAt }),
    ).toEqual({
      kind: "authenticated",
      accountId,
      tokenVersion: 0,
      sessionId: issued.sessionId,
      expiresAt: issued.expiresAt,
    })

    const rotated = await applications.rotate.execute({
      rawToken: issued.rawToken,
      now: rotatedAt,
      auditContext,
    })
    if (rotated instanceof Error || rotated.kind !== "rotated") {
      throw new Error("expected System Session rotation")
    }

    expect(rotated.rawToken).not.toBe(issued.rawToken)
    expect(
      await applications.authenticate.execute({ rawToken: issued.rawToken, now: rotatedAt }),
    ).toEqual({ kind: "rejected", reason: "invalid" })
    expect(
      await applications.authenticate.execute({ rawToken: rotated.rawToken, now: rotatedAt }),
    ).toEqual({
      kind: "authenticated",
      accountId,
      tokenVersion: 0,
      sessionId: rotated.sessionId,
      expiresAt: rotated.expiresAt,
    })

    expect(
      await applications.revoke.execute({
        rawToken: rotated.rawToken,
        now: revokedAt,
        auditContext,
      }),
    ).toEqual({ kind: "completed" })
    expect(
      await applications.authenticate.execute({ rawToken: rotated.rawToken, now: revokedAt }),
    ).toEqual({ kind: "rejected", reason: "invalid" })

    const stored = (
      await fixture.database
        .prepare("SELECT token_hash, revoked_at FROM system_sessions ORDER BY created_at")
        .all<{ token_hash: string; revoked_at: number | null }>()
    ).results
    expect(stored).toHaveLength(2)
    expect(stored.every((row) => row.token_hash !== issued.rawToken)).toBe(true)
    expect(stored.every((row) => row.token_hash !== rotated.rawToken)).toBe(true)
    expect(stored.every((row) => row.revoked_at === revokedAt.getTime())).toBe(true)
    expect(
      (
        await fixture.database
          .prepare("SELECT action FROM system_audit_events ORDER BY occurred_at, rowid")
          .all<{ action: string }>()
      ).results.map((row) => row.action),
    ).toEqual(["auth.session.create", "auth.session.rotate", "auth.session.revoke"])
  })
})
