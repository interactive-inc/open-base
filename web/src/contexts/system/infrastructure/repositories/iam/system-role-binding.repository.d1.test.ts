import { testAccountId } from "@system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { SystemAccountCatalogRepository } from "@system/infrastructure/repositories/iam/system-account-catalog.repository"
import { SystemRoleBindingRepository } from "@system/infrastructure/repositories/iam/system-role-binding.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/**
 * last-root guardはbatch内でUPDATEの「後ろ」に置かれたpost-state checkであり、
 * 「active rootが1人でも残っているか」を見る。評価時点で対象行は既に変更済みなので、
 * role binding削除経路のotherActiveRootCount（更新「前」に自分以外を数える）と違い、
 * EXISTS側から対象自身を除外しない。除外すると二重に引いて保護が壊れる。
 * ここではその等価性を、対象を除外しないまま最後の1人が守られることで固定する。
 */

const now = new Date("2026-01-01T00:00:00.000Z")
const rootAccountId = zAccountId.parse(testAccountId("system-guard-root"))
const secondRootAccountId = zAccountId.parse(testAccountId("system-guard-root-2"))
const actorAccountId = zAccountId.parse(testAccountId("80578462-3441-4701-8709-0fff05cbe826"))

function createRootRole(): IamRoleEntity {
  const role = IamRoleEntity.create({
    id: "af285551-000d-4320-8ea0-bbfbc6c96a81",
    key: "system:root",
    kind: "managed",
    name: "System root",
    description: null,
    permissionKeys: ["iam:read", "iam:write", "system:admin"],
    createdAt: now,
    updatedAt: now,
  })
  if (role instanceof Error) throw role

  return role
}

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(`INSERT INTO system_iam_roles
         (id, key, kind, name, description, created_at, updated_at)
       VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:root', 'managed', 'System root', NULL, ?1, ?1)`)
    .bind(now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:read'), ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'iam:write'), ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin')`)
    .run()

  return fixture
}

/** activeなaccount・activated identity・global root bindingの3点を揃えてrootを作る。 */
/** 割当の主キーは UUID のため、root ごとに決まった値を使う。 */
const bindingIds: Record<string, string> = {
  root: "8d9a49af-964f-426a-88d1-d3de8279d573",
  root2: "5e0f7c3a-1d2b-4c5d-8e6f-0000000000c2",
  actor: "5e0f7c3a-1d2b-4c5d-8e6f-0000000000c3",
}

function bindingIdOf(suffix: string): string {
  const id = bindingIds[suffix]
  if (id === undefined) throw new Error(`unknown root fixture: ${suffix}`)
  return id
}

async function insertRoot(
  fixture: SystemSessionTestContext,
  accountId: string,
  suffix: string,
  options?: Readonly<{ activatedIdentity?: boolean }>,
): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES (?1, ?2, 'password', ?3, ?4, ?5, NULL)`)
    .bind(
      `identity-${suffix}`,
      accountId,
      `${suffix}@example.com`,
      now.getTime(),
      options?.activatedIdentity === false ? null : now.getTime(),
    )
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?1, ?2, 'af285551-000d-4320-8ea0-bbfbc6c96a81', NULL, NULL, ?3, NULL)`)
    .bind(bindingIdOf(suffix), accountId, now.getTime())
    .run()
}

async function readBinding(
  fixture: SystemSessionTestContext,
  bindingId: string,
): Promise<RoleBindingEntity | Error> {
  return RoleBindingEntity.create({
    id: bindingId,
    accountId:
      (
        await fixture.database
          .prepare("SELECT account_id FROM system_role_bindings WHERE id = ?1")
          .bind(bindingId)
          .first<{ account_id: string }>()
      )?.account_id ?? "",
    roleId: "af285551-000d-4320-8ea0-bbfbc6c96a81",
    resource: null,
    createdAt: now,
    revokedAt: null,
  })
}

describe("System role binding last-root guard", () => {
  test("最後のrootのbindingは、対象を除外しないpost-state checkで守られる", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    // actorはrootではないがiam:writeを持たないので、system:adminを持つ別rootを立てて
    // actor≠targetにする。actorのidentityは未activateなので「残存するroot」に数えられない。
    await insertRoot(fixture, actorAccountId, "actor", { activatedIdentity: false })

    const binding = await readBinding(fixture, "8d9a49af-964f-426a-88d1-d3de8279d573")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(actorAccountId, createRootRole(), binding, now, [])

    // actor≠targetなので自己チェックは通り、last-root guardが409相当で止める。
    expect(revocation).toBe("last_root")
    // rollbackにより、bindingもtoken_versionも巻き戻っている。
    expect(
      await fixture.database
        .prepare(
          "SELECT revoked_at FROM system_role_bindings WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ revoked_at: null })
    expect(
      await fixture.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(rootAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ token_version: 0 })
  })

  test("rootが2人いるとき、1人のbindingは失効できる", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    await insertRoot(fixture, secondRootAccountId, "root2")

    const binding = await readBinding(fixture, "8d9a49af-964f-426a-88d1-d3de8279d573")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(
      secondRootAccountId,
      createRootRole(),
      binding,
      now,
      [],
    )

    expect(revocation).toBe("revoked")
    expect(
      await fixture.database
        .prepare(
          "SELECT revoked_at FROM system_role_bindings WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ revoked_at: now.getTime() })
  })

  test("最後のrootでも、自分以外のbindingの失効は通る（過剰に締めていない）", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    // targetはrootではない一般accountなので、失効してもrootは減らない。
    await fixture.database
      .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(secondRootAccountId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, description, created_at, updated_at)
         VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'system:reader', 'custom', 'Reader', NULL, ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'iam:read')`)
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('b0ab0b5e-6e32-409a-8da8-c7fb74783ac6', ?1, '04635707-bd54-47ea-81d4-38426e3ce8a2', NULL, NULL, ?2, NULL)`)
      .bind(secondRootAccountId, now.getTime())
      .run()

    const binding = RoleBindingEntity.create({
      id: "b0ab0b5e-6e32-409a-8da8-c7fb74783ac6",
      accountId: secondRootAccountId,
      roleId: "04635707-bd54-47ea-81d4-38426e3ce8a2",
      resource: null,
      createdAt: now,
      revokedAt: null,
    })
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const readerRole = IamRoleEntity.create({
      id: "04635707-bd54-47ea-81d4-38426e3ce8a2",
      key: "system:reader",
      kind: "custom",
      name: "Reader",
      description: null,
      permissionKeys: ["iam:read"],
      createdAt: now,
      updatedAt: now,
    })
    expect(readerRole).not.toBeInstanceOf(Error)
    if (readerRole instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    const revocation = await repository.revoke(rootAccountId, readerRole, binding, now, [])

    expect(revocation).toBe("revoked")
  })

  test("自分のbindingの失効は、rootが複数いても拒否される", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    await insertRoot(fixture, secondRootAccountId, "root2")

    const binding = await readBinding(fixture, "8d9a49af-964f-426a-88d1-d3de8279d573")
    expect(binding).not.toBeInstanceOf(Error)
    if (binding instanceof Error) return

    const repository = new SystemRoleBindingRepository(fixture.context)
    // rootが2人いるのでlast-root guardは発火しない。自己チェックだけが理由で止まる。
    const revocation = await repository.revoke(rootAccountId, createRootRole(), binding, now, [])

    expect(revocation).toBe("forbidden")
    expect(
      await fixture.database
        .prepare(
          "SELECT revoked_at FROM system_role_bindings WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ revoked_at: null })
  })
})

describe("System account last-root guard", () => {
  test("最後のrootのsuspendは、対象を除外しないpost-state checkで守られる", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    await insertRoot(fixture, actorAccountId, "actor", { activatedIdentity: false })

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(actorAccountId, rootAccountId, "suspended", now, [])

    expect(update).toBe("last_root")
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_accounts WHERE id = ?1")
        .bind(rootAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "active" })
  })

  test("rootが2人いるとき、1人のsuspendは通る", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    await insertRoot(fixture, secondRootAccountId, "root2")

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(
      secondRootAccountId,
      rootAccountId,
      "suspended",
      now,
      [],
    )

    expect(update).toBe("updated")
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_accounts WHERE id = ?1")
        .bind(rootAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "suspended" })
  })

  test("自分のsuspendは、rootが複数いても拒否される", async () => {
    const fixture = await createFixture()
    await insertRoot(fixture, rootAccountId, "root")
    await insertRoot(fixture, secondRootAccountId, "root2")

    const repository = new SystemAccountCatalogRepository(fixture.context)
    const update = await repository.setStatus(rootAccountId, rootAccountId, "suspended", now, [])

    expect(update).toBe("forbidden")
    expect(
      await fixture.database
        .prepare("SELECT status FROM system_accounts WHERE id = ?1")
        .bind(rootAccountId)
        .first<Record<string, unknown>>(),
    ).toEqual({ status: "active" })
  })
})
