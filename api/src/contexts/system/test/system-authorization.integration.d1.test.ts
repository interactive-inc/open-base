import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { systemResourceScopeKey } from "@system/domain/definitions/system-resource-scope-key.definition"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = `
CREATE TABLE system_accounts (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, token_version INTEGER NOT NULL,
  closed_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE system_iam_roles (
  id TEXT PRIMARY KEY, key TEXT NOT NULL, kind TEXT NOT NULL, resource_type TEXT, name TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE system_iam_role_permissions (
  role_id TEXT NOT NULL, permission_key TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);
CREATE TABLE system_role_bindings (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, role_id TEXT NOT NULL,
  resource_type TEXT, resource_id TEXT, created_at INTEGER NOT NULL, revoked_at INTEGER
);
`

describe("canonical System authorization", () => {
  test("active Accountのglobalと完全一致resource bindingだけをlive解決する", async () => {
    const database = await createLocalD1Database({ schema })
    await execSql(
      database,
      `
      INSERT INTO system_accounts VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('f1cc5a29-2cdd-4294-8233-37aed4312992', 'system:operator', 'managed', NULL, 'Operator', 1000, 1000);
      INSERT INTO system_iam_roles VALUES ('d0632d53-fa2d-4749-8436-96bd3cb5aef6', 'example:manager', 'custom', 'example:organization', 'Manager', 1000, 1000);
      INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('f1cc5a29-2cdd-4294-8233-37aed4312992', 'iam:read');
      INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('d0632d53-fa2d-4749-8436-96bd3cb5aef6', 'example:write');
      INSERT INTO system_role_bindings VALUES ('852cc16d-b48a-4126-85cd-75f7ba82c433', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'f1cc5a29-2cdd-4294-8233-37aed4312992', NULL, NULL, 1000, NULL);
      INSERT INTO system_role_bindings VALUES ('707b116e-f378-438a-8961-d7548f7597ce', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'd0632d53-fa2d-4749-8436-96bd3cb5aef6', 'example:organization', 'org-1', 1000, NULL);
    `,
    )
    const repository = new SystemD1AuthorizationAdapter({ env: { DB: database } })

    const graph = await repository.loadForAccount(
      zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
    )
    expect(graph).not.toBeInstanceOf(Error)
    if (graph === null || graph instanceof Error) throw graph
    expect(
      graph.roles.find((role) => role.id === "f1cc5a29-2cdd-4294-8233-37aed4312992")?.resourceType,
    ).toBeNull()
    expect(
      graph.roles.find((role) => role.id === "d0632d53-fa2d-4749-8436-96bd3cb5aef6")?.resourceType,
    ).toBe("example:organization")

    const global = await repository.resolveForAccount({
      accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
      resource: null,
      at: new Date(2000),
    })
    expect(global).not.toBeInstanceOf(Error)
    if (global === null || global instanceof Error) throw global
    expect([...global.permissionKeys]).toEqual(["iam:read"])
    expect(global.roleKeys).toEqual(["system:operator"])
    expect([
      ...(global.scopedPermissionKeys.get(
        systemResourceScopeKey({ type: "example:organization", id: "org-1" }),
      ) ?? []),
    ]).toEqual(["example:write"])

    const scoped = await repository.resolveForAccount({
      accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
      resource: { type: "example:organization", id: "org-1" },
      at: new Date(2000),
    })
    expect(scoped).not.toBeInstanceOf(Error)
    if (scoped === null || scoped instanceof Error) throw scoped
    expect([...scoped.permissionKeys].sort()).toEqual(["example:write", "iam:read"])

    await execSql(
      database,
      `
      INSERT INTO system_iam_roles VALUES ('role-broken', 'example:broken', 'custom', 'example:site', 'Broken', 1000, 1000);
      INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('role-broken', 'example:write');
      INSERT INTO system_role_bindings VALUES ('binding-broken', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'role-broken', 'example:organization', 'org-1', 1000, NULL);
    `,
    )
    expect(
      await repository.loadForAccount(zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")),
    ).toBeInstanceOf(Error)
  })

  test("inactiveまたは欠損Accountを同じnullへ畳み、DB障害はErrorにする", async () => {
    const database = await createLocalD1Database({ schema })
    await execSql(
      database,
      "INSERT INTO system_accounts VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'suspended', 1, NULL, 1000, 1000)",
    )
    const repository = new SystemD1AuthorizationAdapter({ env: { DB: database } })

    expect(
      await repository.resolveForAccount({
        accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeNull()
    await execSql(database, "DROP TABLE system_accounts")
    expect(
      await repository.resolveForAccount({
        accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
        resource: null,
        at: new Date(2000),
      }),
    ).toBeInstanceOf(Error)
  })
})
