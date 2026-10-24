import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import { preparePreservedRecordReadAuthorization } from "@system/interface/authorization/prepare-preserved-record-read-authorization"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const at = new Date("2035-01-01T00:00:00Z")

async function fixture(kind: "human" | "agent" | "service" | "connector" | "legacy" = "human") {
  const db = await createSystemAttachmentTestDatabase()
  await execSql(
    db,
    "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ('f43d89f4-ac52-411f-828b-78838556ce92','active',0,100,100),('28689052-c77f-42e5-8f85-1b461d9f5514','active',0,100,100); INSERT INTO system_iam_roles(id,key,kind,name,created_at,updated_at) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2','reader:role','custom','Reader',100,100); INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2','records:read'); INSERT INTO system_role_bindings(id,account_id,role_id,created_at) VALUES ('72da13a4-abc7-476f-8499-074d4f8a8854','f43d89f4-ac52-411f-828b-78838556ce92','04635707-bd54-47ea-81d4-38426e3ce8a2',100);",
  )
  if (kind === "connector")
    await execSql(
      db,
      "INSERT INTO system_connectors(id,key,name,direction,transport,status,revision,created_at,updated_at) VALUES ('connector','connector','Test connector','bidirectional','api','active',1,100,100)",
    )
  if (kind !== "legacy")
    await db
      .prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,connector_id,revision,created_at,updated_at) VALUES ('3aaf5fcf-c1c5-4546-810f-8597f0e1c24c','f43d89f4-ac52-411f-828b-78838556ce92',?1,'Reader',?2,1,100,100)",
      )
      .bind(kind, kind === "connector" ? "connector" : null)
      .run()
  const machine = kind !== "human" && kind !== "legacy"
  if (machine)
    await db
      .prepare(
        "INSERT INTO system_machine_credentials(id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at,expires_at) VALUES ('191cfb61-8651-48e7-ba07-a1d05b732365','3aaf5fcf-c1c5-4546-810f-8597f0e1c24c','Reader key',?1,'active',100,?2,?2,?3)",
      )
      .bind("a".repeat(64), at.getTime(), at.getTime() + 60000)
      .run()
  const authentication: SystemReadAuthentication = {
    accountId: zAccountId.parse("f43d89f4-ac52-411f-828b-78838556ce92"),
    tokenVersion: 0,
    issuedAtMs: at.getTime(),
    expiresAtMs: at.getTime() + 60000,
    machineCredentialId: machine ? "191cfb61-8651-48e7-ba07-a1d05b732365" : null,
    identityBindingId: null,
  }
  const adapter = new PrepareSystemReadAuthorizationAdapter({ env: { DB: db } })
  const prepare = () => adapter.prepare(authentication, at)
  return { db, authentication, adapter, prepare }
}

test.each(["human", "legacy", "agent", "service", "connector"] as const)(
  "%s の現在の権限と発行元をSystemだけで検証する",
  async (kind) => {
    const f = await fixture(kind)
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    expect([...prepared.permissionKeys]).toEqual(["records:read"])
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect((await f.db.batch([...assertions])).every((row) => row.success)).toBe(true)
    expect(JSON.stringify(prepared)).not.toContain("a".repeat(64))
    const expired = prepared.assertions(new Date(at.getTime() + 60000))
    if (expired instanceof Error) throw expired
    expect(await f.db.batch([...expired]).catch((error: unknown) => error)).toBeInstanceOf(Error)
    expect(
      await f.adapter.prepare({ ...f.authentication, expiresAtMs: at.getTime() }, at),
    ).toBeInstanceOf(Error)
  },
)

test.each(["account", "grant", "role", "3aaf5fcf-c1c5-4546-810f-8597f0e1c24c"])(
  "準備後の %s の変更をtransactionで拒否する",
  async (kind) => {
    const f = await fixture()
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    const sql =
      kind === "account"
        ? "UPDATE system_accounts SET token_version=1 WHERE id='f43d89f4-ac52-411f-828b-78838556ce92'"
        : kind === "grant"
          ? "DELETE FROM system_iam_role_permissions WHERE role_id='04635707-bd54-47ea-81d4-38426e3ce8a2'"
          : kind === "role"
            ? "UPDATE system_iam_roles SET updated_at=101 WHERE id='04635707-bd54-47ea-81d4-38426e3ce8a2'"
            : "UPDATE system_principals SET revision=2,updated_at=101 WHERE id='3aaf5fcf-c1c5-4546-810f-8597f0e1c24c'"
    await execSql(f.db, sql)
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  },
)

test.each(["agent", "service", "connector"] as const)(
  "%s のcredentialは別の発行元・人のtoken・失効で代用できない",
  async (kind) => {
    const f = await fixture(kind)
    for (const machineCredentialId of [null, "missing"])
      expect(await f.adapter.prepare({ ...f.authentication, machineCredentialId }, at)).toBeNull()
    const prepared = await f.prepare()
    if (prepared === null || prepared instanceof Error)
      throw new Error("authorization missing", { cause: prepared })
    await f.db
      .prepare(
        "UPDATE system_machine_credentials SET status='revoked',revoked_at=?1,updated_at=?1 WHERE id='191cfb61-8651-48e7-ba07-a1d05b732365'",
      )
      .bind(at.getTime())
      .run()
    const assertions = prepared.assertions(at)
    if (assertions instanceof Error) throw assertions
    expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
    expect(await f.prepare()).toBeNull()
  },
)

test("connectorの停止と将来の権限失効を、時計を進めた開示でも検出する", async () => {
  const f = await fixture("connector")
  const prepared = await f.prepare()
  if (prepared === null || prepared instanceof Error)
    throw new Error("authorization missing", { cause: prepared })
  await execSql(
    f.db,
    "UPDATE system_connectors SET status='disabled',revision=2,updated_at=101 WHERE id='connector'",
  )
  const assertions = prepared.assertions(at)
  if (assertions instanceof Error) throw assertions
  expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  const human = await fixture()
  await human.db
    .prepare(
      "UPDATE system_role_bindings SET revoked_at=?1 WHERE id='72da13a4-abc7-476f-8499-074d4f8a8854'",
    )
    .bind(at.getTime() + 1000)
    .run()
  const active = await human.prepare()
  if (active === null || active instanceof Error)
    throw new Error("authorization missing", { cause: active })
  const later = active.assertions(new Date(at.getTime() + 1000))
  if (later instanceof Error) throw later
  expect(await human.db.batch([...later]).catch((error: unknown) => error)).toBeInstanceOf(Error)
})

test("外部認証は確認したidentityを固定し、別Accountのidentityと取消を拒否する", async () => {
  const f = await fixture()
  await execSql(
    f.db,
    "INSERT INTO system_identity_bindings(id,account_id,provider,subject,created_at,activated_at) VALUES ('7e55ffc7-bc22-4d3b-b321-916eff4b6104','f43d89f4-ac52-411f-828b-78838556ce92','oidc','reader-subject',100,100),('64a8b60a-73d9-4ae8-93dc-4620a3897e74','28689052-c77f-42e5-8f85-1b461d9f5514','oidc','other-subject',100,100)",
  )
  expect(
    await f.adapter.prepare(
      { ...f.authentication, identityBindingId: "64a8b60a-73d9-4ae8-93dc-4620a3897e74" },
      at,
    ),
  ).toBeNull()
  const authentication = {
    ...f.authentication,
    identityBindingId: "7e55ffc7-bc22-4d3b-b321-916eff4b6104",
  }
  const prepared = await f.adapter.prepare(authentication, at)
  if (prepared === null || prepared instanceof Error)
    throw new Error("authorization missing", { cause: prepared })
  await f.db
    .prepare(
      "UPDATE system_identity_bindings SET revoked_at=?1 WHERE id='7e55ffc7-bc22-4d3b-b321-916eff4b6104'",
    )
    .bind(at.getTime())
    .run()
  const assertions = prepared.assertions(at)
  if (assertions instanceof Error) throw assertions
  expect(await f.db.batch([...assertions]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  expect(await f.adapter.prepare(authentication, at)).toBeNull()
})

test.each(["human", "agent", "service", "connector"] as const)(
  "%s requires the explicit record operation permission",
  async (kind) => {
    const f = await fixture(kind)
    const input = { authentication: f.authentication, action: "read" as const, at }
    expect(await preparePreservedRecordReadAuthorization({ env: { DB: f.db } }, input)).toBeNull()
    await execSql(
      f.db,
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'system:record:read')",
    )
    const proof = await preparePreservedRecordReadAuthorization({ env: { DB: f.db } }, input)
    if (proof === null || proof instanceof Error)
      throw new Error("missing explicit read permission")
    expect(
      await preparePreservedRecordReadAuthorization(
        { env: { DB: f.db } },
        { ...input, action: "export" },
      ),
    ).toBeNull()
    const assertions = proof.assertions(at)
    if (assertions instanceof Error) throw assertions
    await execSql(f.db, "DELETE FROM system_iam_role_permissions")
    expect(await f.db.batch([...assertions]).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
  },
)

test.each(["human", "agent", "service", "connector"] as const)(
  "%s needs explicit preservation permission and loses it at commit after revocation",
  async (kind) => {
    const f = await fixture(kind)
    const input = { authentication: f.authentication, at }
    const context = { env: { DB: f.db } }
    await execSql(
      f.db,
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2','system:record:read'),('04635707-bd54-47ea-81d4-38426e3ce8a2','system:record:export')",
    )
    expect(await preparePreservedRecordWriteAuthorization(context, input)).toBeNull()
    await execSql(
      f.db,
      "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2','system:record:preserve')",
    )
    const proof = await preparePreservedRecordWriteAuthorization(context, input)
    if (proof === null || proof instanceof Error) throw new Error("missing preservation permission")
    expect(
      await preparePreservedRecordReadAuthorization(context, { ...input, action: "read" }),
    ).toBeNull()
    const guards = proof.assertions(at)
    if (guards instanceof Error) throw guards
    await f.db.batch([...guards])
    await execSql(f.db, "DELETE FROM system_iam_role_permissions")
    expect(await f.db.batch([...guards]).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(await preparePreservedRecordWriteAuthorization(context, input)).toBeNull()
  },
)
