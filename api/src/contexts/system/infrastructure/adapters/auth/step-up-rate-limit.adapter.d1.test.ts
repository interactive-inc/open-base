import { expect, test } from "bun:test"
import { StepUpRateLimitAdapter } from "@system/infrastructure/adapters/auth/step-up-rate-limit.adapter"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("6c047840-0ba9-4c7a-8491-8dda0db0dc15")

test("parallel attempts cannot exceed the pair limit or extend its time window", async () => {
  const fixture = await SystemSessionTestContext.create()
  const adapter = new StepUpRateLimitAdapter({ database: fixture.database })
  const attempts = await Promise.all(
    Array.from({ length: 25 }, () => adapter.recordAndCheck({ accountId, ip: "192.0.2.1", now })),
  )

  expect(attempts.filter((limited) => limited === false)).toHaveLength(10)
  expect(attempts.filter((limited) => limited === true)).toHaveLength(15)
  expect(
    await adapter.recordAndCheck({
      accountId,
      ip: "192.0.2.1",
      now: new Date(now.getTime() + 900_001),
    }),
  ).toBe(false)
  expect(
    await fixture.database
      .prepare("SELECT count(*) AS total FROM system_authentication_attempts")
      .first<{ total: number }>(),
  ).toEqual({ total: 1 })
}, 30_000)

test("changing IPs cannot evade the account limit or block another account prematurely", async () => {
  const fixture = await SystemSessionTestContext.create()
  const adapter = new StepUpRateLimitAdapter({ database: fixture.database })
  for (const ip of ["192.0.2.1", "192.0.2.2"]) {
    for (const attempt of Array.from({ length: 10 })) {
      void attempt
      expect(await adapter.recordAndCheck({ accountId, ip, now })).toBe(false)
    }
  }
  expect(await adapter.recordAndCheck({ accountId, ip: "192.0.2.3", now })).toBe(true)
  expect(
    await adapter.recordAndCheck({
      accountId: zAccountId.parse(crypto.randomUUID()),
      ip: "192.0.2.1",
      now,
    }),
  ).toBe(false)
}, 30_000)

test("IP spray counts only step-up attempts and does not cross to other IPs", async () => {
  const fixture = await SystemSessionTestContext.create()
  const adapter = new StepUpRateLimitAdapter({ database: fixture.database })
  await fixture.database.batch(
    Array.from({ length: 51 }, (_, index) =>
      fixture.database
        .prepare(
          "INSERT INTO system_authentication_attempts (id, identifier, ip, attempted_at) VALUES (?1, ?2, '192.0.2.1', ?3)",
        )
        .bind(crypto.randomUUID(), `you+${index}@example.com`, now.getTime()),
    ),
  )
  for (const account of Array.from({ length: 5 }, () => zAccountId.parse(crypto.randomUUID()))) {
    for (const attempt of Array.from({ length: 10 })) {
      void attempt
      expect(await adapter.recordAndCheck({ accountId: account, ip: "192.0.2.1", now })).toBe(false)
    }
  }
  expect(
    await adapter.recordAndCheck({
      accountId: zAccountId.parse(crypto.randomUUID()),
      ip: "192.0.2.1",
      now,
    }),
  ).toBe(true)
  expect(
    await adapter.recordAndCheck({
      accountId: zAccountId.parse(crypto.randomUUID()),
      ip: "192.0.2.2",
      now,
    }),
  ).toBe(false)
}, 30_000)

test("unrecordable input is denied and a database failure remains an explicit error", async () => {
  const fixture = await SystemSessionTestContext.create()
  const adapter = new StepUpRateLimitAdapter({ database: fixture.database })
  await fixture.database.prepare("DROP TABLE system_authentication_attempts").run()
  for (const ip of ["", "a".repeat(256), "\u0000"]) {
    expect(await adapter.recordAndCheck({ accountId, ip, now })).toBe(true)
  }
  expect(await adapter.recordAndCheck({ accountId, ip: null, now })).toBeInstanceOf(Error)
  expect(await adapter.reset(accountId)).toBeInstanceOf(Error)
}, 30_000)
