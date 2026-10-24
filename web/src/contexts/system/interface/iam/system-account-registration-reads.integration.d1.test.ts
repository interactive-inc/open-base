import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { hasSystemIdentitySubject } from "@system/interface/operations/has-system-identity-subject"
import { readSystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"
import { readSystemRoleRevision } from "@system/interface/operations/read-system-role-revision"
import { readSystemRoleGrants } from "@system/interface/operations/read-system-role-grants"
import { readSystemIdentityEmailEligibility } from "@system/interface/operations/read-system-identity-email-eligibility"
import { readSystemRoleBindingGrants } from "@system/interface/operations/read-system-role-binding-grants"
import { readSystemInitialPasswordTarget } from "@system/interface/operations/read-system-initial-password-target"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("招待登録用のSystem読取はIdentity重複、Account状態、Role版を公開する", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'active', 2, 100, 200)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'password', 'person@example.com', 100, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'demo:member', 'managed', 'demo:scope', 'Member', 100, 200)",
  )
  const database = fixture.context.env.DB

  expect(
    await hasSystemIdentitySubject(database, {
      provider: "password",
      subject: "person@example.com",
    }),
  ).toBe(true)
  expect(
    await hasSystemIdentitySubject(database, {
      provider: "password",
      subject: "other@example.com",
    }),
  ).toBe(false)
  expect(await readSystemAccountSnapshot(database, "59d1cf87-ae64-4e2f-8316-d3b1505c96ed")).toEqual(
    {
      id: "59d1cf87-ae64-4e2f-8316-d3b1505c96ed",
      status: "active",
      tokenVersion: 2,
      closedAt: null,
      updatedAt: new Date(200),
    },
  )
  expect(await readSystemRoleRevision(database, "a290ac92-bf4b-434b-8443-8b6ceeb1cb85")).toEqual({
    id: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
    name: "Member",
    resourceType: "demo:scope",
    updatedAt: new Date(200),
  })
})

test("初期password発行のSystem読取はcredentialを返さず有効なroot割当だけを評価する", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'active', 0, 100, 200)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'password', 'person@example.com', 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_identity_profiles (identity_id, email, can_receive_email, updated_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', 'person@example.com', 0, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_password_credentials (identity_id, password_hash, changed_at, created_at, updated_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', 'secret-hash', 100, 100, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'legacy-root', 'managed', 'Root', 100, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('af285551-000d-4320-8ea0-bbfbc6c96a81', 'system:admin')",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('f16b950f-c6db-4760-8994-95cc8065169d', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'af285551-000d-4320-8ea0-bbfbc6c96a81', 100)",
  )
  const database = fixture.context.env.DB

  expect(
    await readSystemInitialPasswordTarget(database, "59d1cf87-ae64-4e2f-8316-d3b1505c96ed"),
  ).toEqual({
    user: { id: "59d1cf87-ae64-4e2f-8316-d3b1505c96ed", disabledAt: null },
    identities: [
      {
        id: "637b1ce9-daa9-4063-8cb0-1190607a2ceb",
        email: "person@example.com",
        canReceiveEmail: false,
      },
    ],
    targetHasRootGrant: true,
  })
  await execSql(
    fixture.database,
    "UPDATE system_role_bindings SET revoked_at = 201 WHERE id = 'f16b950f-c6db-4760-8994-95cc8065169d'",
  )
  expect(
    await readSystemInitialPasswordTarget(database, "59d1cf87-ae64-4e2f-8316-d3b1505c96ed"),
  ).toMatchObject({
    targetHasRootGrant: false,
  })
  await execSql(
    fixture.database,
    "UPDATE system_accounts SET status = 'locked' WHERE id = '59d1cf87-ae64-4e2f-8316-d3b1505c96ed'",
  )
  expect(
    await readSystemInitialPasswordTarget(database, "59d1cf87-ae64-4e2f-8316-d3b1505c96ed"),
  ).toMatchObject({
    user: { disabledAt: new Date(200) },
  })
})

test("招待作成用のSystem読取はRole権限とIdentityの受信可否を返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'active', 0, 100, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'password', 'person@example.com', 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_identity_profiles (identity_id, can_receive_email, updated_at) VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', 0, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'legacy', 'managed', 'demo:scope', 'Member', 100, 100), ('9e9add99-4e1e-4591-8189-fa544d272a2a', 'legacy-2', 'managed', NULL, 'Other', 100, 100)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'demo:write'), ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'demo:read')",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('ae18ee9b-62ff-4396-8971-165b0ac77248', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 100), ('75ae8f32-31e1-4c2d-8dfd-f5c9919e9351', '59d1cf87-ae64-4e2f-8316-d3b1505c96ed', '9e9add99-4e1e-4591-8189-fa544d272a2a', 100)",
  )
  const database = fixture.context.env.DB

  expect(await readSystemRoleGrants(database, "a290ac92-bf4b-434b-8443-8b6ceeb1cb85")).toEqual({
    resourceType: "demo:scope",
    permissionKeys: ["demo:read", "demo:write"],
  })
  expect(await readSystemRoleGrants(database, "9e9add99-4e1e-4591-8189-fa544d272a2a")).toEqual({
    resourceType: null,
    permissionKeys: [],
  })
  expect(await readSystemRoleGrants(database, "missing")).toBeNull()
  expect(
    await readSystemRoleBindingGrants(database, "ae18ee9b-62ff-4396-8971-165b0ac77248"),
  ).toEqual(["demo:read", "demo:write"])
  expect(
    await readSystemRoleBindingGrants(database, "75ae8f32-31e1-4c2d-8dfd-f5c9919e9351"),
  ).toEqual([])
  expect(await readSystemRoleBindingGrants(database, "missing")).toEqual([])
  expect(
    await readSystemIdentityEmailEligibility(database, {
      provider: "password",
      subject: "person@example.com",
    }),
  ).toBe(false)
  expect(
    await readSystemIdentityEmailEligibility(database, {
      provider: "password",
      subject: "missing@example.com",
    }),
  ).toBeNull()
  await execSql(
    fixture.database,
    "DELETE FROM system_identity_profiles WHERE identity_id = '637b1ce9-daa9-4063-8cb0-1190607a2ceb'",
  )
  expect(
    await readSystemIdentityEmailEligibility(database, {
      provider: "password",
      subject: "person@example.com",
    }),
  ).toBeNull()
})
