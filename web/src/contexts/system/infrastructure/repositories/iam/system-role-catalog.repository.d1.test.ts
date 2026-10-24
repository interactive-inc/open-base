import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import type { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const adminActor = zAccountId.parse(testAccountId("role-update-admin"))
const writerActor = zAccountId.parse(testAccountId("role-update-writer"))
const adminRoleId = testLiteralId("role-update-admin-role")
const writerRoleId = testLiteralId("role-update-writer-role")
const targetRoleId = iamRoleIdSchema.parse(testLiteralId("role-update-target-role"))

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  const roles = [
    [adminRoleId, "example:admin", ["iam:write", "system:admin"]],
    [writerRoleId, "example:writer", ["iam:write"]],
    [targetRoleId, "example:target", ["iam:write", "system:admin"]],
  ] as const
  for (const [id, key, permissions] of roles) {
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles (id, key, kind, name, description, created_at, updated_at)
         VALUES (?1, ?2, 'custom', ?2, NULL, ?3, ?3)`)
      .bind(id, key, now.getTime())
      .run()
    for (const permission of permissions) {
      await fixture.database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)",
        )
        .bind(id, permission)
        .run()
    }
  }
  for (const [accountId, roleId] of [
    [adminActor, adminRoleId],
    [writerActor, writerRoleId],
  ] as const) {
    await fixture.database
      .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(accountId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL)`)
      .bind(testLiteralId(`role-update-binding:${accountId}`), accountId, roleId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`)
      .bind(
        testLiteralId(`role-update-identity:${accountId}`),
        accountId,
        `${accountId}@example.com`,
        now.getTime(),
      )
      .run()
  }

  return fixture
}

describe("System Role update guard", () => {
  test("iam:writeだけのactorは自分が持たないpermissionをRoleから剥奪できない", async () => {
    const fixture = await createFixture()
    const repository = new SystemRoleCatalogRepository(fixture.context)
    const previous = await repository.find(targetRoleId)
    if (previous === null || previous instanceof Error) throw new Error("role missing")
    const next = previous.replacePermissions(["iam:write"], new Date(now.getTime() + 1_000))
    if (next instanceof Error) throw next

    expect(await repository.update(writerActor, previous, next, [])).toBe("forbidden")
    expect(permissionKeysOf(await repository.find(targetRoleId))).toEqual([
      "iam:write",
      "system:admin",
    ])
    expect(await repository.update(adminActor, previous, next, [])).toBe("updated")
    expect(permissionKeysOf(await repository.find(targetRoleId))).toEqual(["iam:write"])
  })
})

function permissionKeysOf(role: IamRoleEntity | null | Error): ReadonlyArray<string> | null {
  return role === null || role instanceof Error ? null : role.permissionKeys
}
