import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const adminActor = zAccountId.parse(testAccountId("guard-admin-actor"))
const writerActor = zAccountId.parse(testAccountId("guard-writer-actor"))
const readerWriterActor = zAccountId.parse(testAccountId("guard-reader-writer-actor"))
const adminAgentAccount = testAccountId("guard-admin-agent")
const readerAgentAccount = testAccountId("guard-reader-agent")
const adminAgent = testLiteralId("guard-admin-agent-principal")
const readerAgent = testLiteralId("guard-reader-agent-principal")

const roles = {
  admin: { id: testLiteralId("guard-role-admin"), permissions: ["iam:write", "system:admin"] },
  writer: { id: testLiteralId("guard-role-writer"), permissions: ["iam:write"] },
  readerWriter: {
    id: testLiteralId("guard-role-reader-writer"),
    permissions: ["iam:write", "example:read"],
  },
  reader: { id: testLiteralId("guard-role-reader"), permissions: ["example:read"] },
} as const

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  const database = fixture.database
  for (const [key, role] of Object.entries(roles)) {
    await database
      .prepare(`INSERT INTO system_iam_roles (id, key, kind, name, description, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?2, NULL, ?3, ?3)`)
      .bind(role.id, `guard:${key}`, now.getTime())
      .run()
    for (const permission of role.permissions) {
      await database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)",
        )
        .bind(role.id, permission)
        .run()
    }
  }
  const accounts: ReadonlyArray<readonly [string, string]> = [
    [adminActor, roles.admin.id],
    [writerActor, roles.writer.id],
    [readerWriterActor, roles.readerWriter.id],
    [adminAgentAccount, roles.admin.id],
    [readerAgentAccount, roles.reader.id],
  ]
  for (const [accountId, roleId] of accounts) {
    await database
      .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(accountId, now.getTime())
      .run()
    await database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`)
      .bind(testLiteralId(`guard-binding:${accountId}`), accountId, roleId, now.getTime())
      .run()
  }
  for (const [principalId, accountId] of [
    [adminAgent, adminAgentAccount],
    [readerAgent, readerAgentAccount],
  ] as const) {
    await database
      .prepare(`INSERT INTO system_principals
           (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
         VALUES (?1, ?2, 'agent', 'Agent', NULL, 1, ?3, ?3)`)
      .bind(principalId, accountId, now.getTime())
      .run()
  }

  return fixture
}

function credentialFor(principalId: string, seed: string): SystemMachineCredentialEntity {
  const credential = SystemMachineCredentialEntity.create({
    id: testLiteralId(`guard-credential:${seed}`),
    principalId,
    name: "Primary",
    secretHash: seed.padStart(64, "0").slice(-64),
    status: "active",
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
  })
  if (credential instanceof Error) throw credential

  return credential
}

async function countCredentials(fixture: SystemSessionTestContext): Promise<unknown> {
  return (
    await fixture.database
      .prepare("SELECT count(*) AS total FROM system_machine_credentials")
      .first<{ total: number }>()
  )?.total
}

describe("System actor principal guard", () => {
  test("iam:writeだけのactorはsystem:admin Principalのcredentialを発行できない", async () => {
    const fixture = await createFixture()
    const repository = new SystemMachineCredentialRepository(fixture.context)

    expect(await repository.create(writerActor, credentialFor(adminAgent, "a1"), [])).toBe(
      "forbidden",
    )
    expect(await countCredentials(fixture)).toBe(0)
    expect(await repository.create(readerWriterActor, credentialFor(adminAgent, "a2"), [])).toBe(
      "forbidden",
    )
    expect(await repository.create(writerActor, credentialFor(readerAgent, "a3"), [])).toBe(
      "forbidden",
    )
    expect(await countCredentials(fixture)).toBe(0)
  })

  test("system:adminか対象の全permissionを持つactorは発行できる", async () => {
    const fixture = await createFixture()
    const repository = new SystemMachineCredentialRepository(fixture.context)

    expect(await repository.create(adminActor, credentialFor(adminAgent, "b1"), [])).toBe("created")
    expect(await repository.create(readerWriterActor, credentialFor(readerAgent, "b2"), [])).toBe(
      "created",
    )
    expect(await countCredentials(fixture)).toBe(2)
  })

  test("権限の足りないactorはcredentialを失効できず、十分なactorは失効できる", async () => {
    const fixture = await createFixture()
    const repository = new SystemMachineCredentialRepository(fixture.context)
    const credential = credentialFor(adminAgent, "c1")
    expect(await repository.create(adminActor, credential, [])).toBe("created")
    const later = new Date(now.getTime() + 1_000)

    expect(await repository.revoke(writerActor, adminAgent, credential.id, later, [])).toBe(
      "forbidden",
    )
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_machine_credentials WHERE id = ?1")
        .bind(credential.id)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "active" })
    expect(await repository.revoke(adminActor, adminAgent, credential.id, later, [])).toBe(
      "revoked",
    )
  })

  test("権限の足りないactorはPrincipal名を変更できない", async () => {
    const fixture = await createFixture()
    const repository = new SystemPrincipalRepository(fixture.context)
    const rename = async (actor: AccountId, principalId: string) => {
      const current = await repository.find({ principalId })
      if (current === null || current instanceof Error) throw new Error("principal missing")
      const changed = current.withName("Renamed", new Date(now.getTime() + 1_000))
      if (changed instanceof Error) throw changed
      return repository.update(actor, changed, current.revision, [])
    }

    expect(await rename(writerActor, adminAgent)).toBe("forbidden")
    expect(await rename(writerActor, readerAgent)).toBe("forbidden")
    expect(await rename(readerWriterActor, readerAgent)).toBe("updated")
    expect(await rename(adminActor, adminAgent)).toBe("updated")
  })
})
