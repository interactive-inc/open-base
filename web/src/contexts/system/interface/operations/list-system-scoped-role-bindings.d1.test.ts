import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { listSystemScopedRoleBindings } from "@system/interface/operations/list-system-scoped-role-bindings"
import { readSystemRoleSummary } from "@system/interface/operations/read-system-role-summary"
import { listSystemRoleSummaries } from "@system/interface/operations/list-system-role-summaries"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const target = testAccountId("target")
const other = testAccountId("other")

test("Systemの公開読取は指定resource・時点・Accountの有効なbindingだけを返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('${target}', 'active', 0, 0, 0), ('${other}', 'active', 0, 0, 0)`,
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:manager', 'managed', 'demo:resource', 'Manager', 0, 0)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:manage'), ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:read')",
  )
  await execSql(
    fixture.database,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at) VALUES
     ('5e0f7c3a-1d2b-4c5d-8e6f-0000000000a1', '${target}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 100, NULL),
     ('5e0f7c3a-1d2b-4c5d-8e6f-0000000000a2', '${other}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 300, NULL),
     ('5e0f7c3a-1d2b-4c5d-8e6f-0000000000a3', '${other}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0, 50),
     ('dbcd34b4-9c95-419a-8fc3-d992cd5566d7', '${other}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-2', 0, NULL)`,
  )

  const result = await listSystemScopedRoleBindings({
    database: fixture.context.env.DB,
    resourceType: "demo:resource",
    resourceId: "resource-1",
    at: new Date(200),
  })
  expect(result).toEqual([
    {
      id: "5e0f7c3a-1d2b-4c5d-8e6f-0000000000a1",
      accountId: target,
      roleId: "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620",
      resourceId: "resource-1",
      createdAt: new Date(100),
      permissionKeys: ["demo:manage", "demo:read"],
    },
  ])
  expect(
    await listSystemScopedRoleBindings({
      database: fixture.context.env.DB,
      resourceType: "demo:resource",
      resourceId: "resource-1",
      accountId: other,
      at: new Date(200),
    }),
  ).toEqual([])
  expect(
    await readSystemRoleSummary({
      database: fixture.context.env.DB,
      roleId: "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620",
    }),
  ).toEqual({
    id: "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620",
    resourceType: "demo:resource",
    name: "Manager",
    kind: "managed",
    permissionKeys: ["demo:manage", "demo:read"],
  })
  expect(
    await listSystemRoleSummaries({
      database: fixture.context.env.DB,
      resourceType: "demo:resource",
    }),
  ).toEqual([
    {
      id: "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620",
      resourceType: "demo:resource",
      name: "Manager",
      kind: "managed",
      permissionKeys: ["demo:manage", "demo:read"],
    },
  ])
})
