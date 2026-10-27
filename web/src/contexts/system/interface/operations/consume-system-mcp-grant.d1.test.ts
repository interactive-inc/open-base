import { consumeSystemMcpGrant } from "@system/interface/operations/consume-system-mcp-grant"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1の起動とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = `
  CREATE TABLE system_identity_login_tokens (
    jti TEXT PRIMARY KEY NOT NULL CHECK (length(jti) BETWEEN 1 AND 512),
    expires_at INTEGER NOT NULL,
    used_at INTEGER NOT NULL,
    CHECK (expires_at > used_at)
  );
`

const now = new Date("2026-01-01T00:00:00.000Z")
const exp = Math.floor(now.getTime() / 1_000) + 120

test("同じgrantは1回だけ消費でき、2回目以降はreplayedを返す", async () => {
  const database = await createLocalD1Database({ schema })
  const context = { env: { DB: database } }
  const grant = { jti: "grant-1", exp }

  expect(await consumeSystemMcpGrant(context, { grant, now })).toBe("consumed")
  expect(await consumeSystemMcpGrant(context, { grant, now })).toBe("replayed")
  expect(await consumeSystemMcpGrant(context, { grant: { jti: "grant-2", exp }, now })).toBe(
    "consumed",
  )
  expect(
    (
      await database
        .prepare("SELECT jti, expires_at FROM system_identity_login_tokens ORDER BY jti")
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([
    { jti: "mcp-grant:grant-1", expires_at: exp * 1_000 },
    { jti: "mcp-grant:grant-2", expires_at: exp * 1_000 },
  ])
})

test("並行した消費は1つだけが成功する", async () => {
  const database = await createLocalD1Database({ schema })
  const context = { env: { DB: database } }
  const grant = { jti: "grant-1", exp }

  const results = await Promise.all([
    consumeSystemMcpGrant(context, { grant, now }),
    consumeSystemMcpGrant(context, { grant, now }),
  ])

  expect(results.toSorted()).toEqual(["consumed", "replayed"])
})

test("外部Identity tokenの記録と同じ値のjtiでもMCP grantの消費とは衝突しない", async () => {
  const database = await createLocalD1Database({ schema })
  await database
    .prepare(
      "INSERT INTO system_identity_login_tokens (jti, expires_at, used_at) VALUES (?1, ?2, ?3)",
    )
    .bind("grant-1", exp * 1_000, now.getTime())
    .run()

  expect(
    await consumeSystemMcpGrant({ env: { DB: database } }, { grant: { jti: "grant-1", exp }, now }),
  ).toBe("consumed")
})

test("記録できなければErrorを返し、消費済みとして扱わない", async () => {
  const database = await createLocalD1Database({ schema: "CREATE TABLE unrelated (id TEXT);" })

  expect(
    await consumeSystemMcpGrant({ env: { DB: database } }, { grant: { jti: "grant-1", exp }, now }),
  ).toBeInstanceOf(Error)
})
