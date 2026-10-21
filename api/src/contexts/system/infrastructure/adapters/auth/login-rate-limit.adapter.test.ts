import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { LoginRateLimitAdapter } from "@/contexts/system/infrastructure/adapters/auth/login-rate-limit.adapter"
import * as schema from "@system/infrastructure/schema/system-core"

/**
 * レートリミットを module-scope Map から D1 の system_authentication_attempts へ移した分散カウンタの検証。
 * 対象テーブルと索引を正本の DDL で作成した bun:sqlite 上で、窓境界・失敗のみカウント・成功リセット・掃除・
 * 別インスタンス (=別 isolate 相当) からの可視性を固定する。窓判定は attempted_at 列の Date 比較に
 * 依存するため、窓境界を「now で拒否 / now-WINDOW 直後で許可」の両端で assert して silent break を防ぐ。
 */

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const MAX_ATTEMPTS_PER_ACCOUNT = MAX_ATTEMPTS * 2
const MAX_ATTEMPTS_PER_IP = 50

const coreSchema = readFileSync(new URL("../../schema/system-core.sql", import.meta.url), "utf8")
const authenticationAttemptsSchema = coreSchema.match(
  /CREATE TABLE system_authentication_attempts \([\s\S]*?CREATE INDEX system_authentication_attempts_ip_attempted_at_idx[\s\S]*?;/,
)?.[0]
if (authenticationAttemptsSchema === undefined) {
  throw new Error("Authentication attempts schema was not found")
}
const sqlite = new Database(":memory:")
sqlite.run(authenticationAttemptsSchema)
const db = drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>
function createRateLimit(database: DrizzleD1Database<typeof schema>) {
  const context: SystemDatabaseContext & SystemClockContext = {
    var: { database, now: () => new Date() },
  }
  return new LoginRateLimitAdapter(context)
}
const rateLimit = createRateLimit(db)

const loginRateLimitKey = (ip: string | null, identifier: string) =>
  LoginRateLimitAdapter.loginKey(ip, identifier)
const internalVerifyRateLimitKey = (ip: string | null, userId: string) =>
  LoginRateLimitAdapter.internalVerifyKey(ip, userId)

function isLoginRateLimited(database: DrizzleD1Database<typeof schema>, key: string, now?: number) {
  return createRateLimit(database).isLimited({ key, now })
}

function recordLoginAttempt(database: DrizzleD1Database<typeof schema>, key: string, now?: number) {
  return createRateLimit(database).record({ key, now })
}

function resetLoginAttempts(database: DrizzleD1Database<typeof schema>, key: string) {
  return createRateLimit(database).reset({ key })
}

function recordAndCheckLoginAttempt(
  database: DrizzleD1Database<typeof schema>,
  identifier: string,
  ip: string | null,
  now?: number,
) {
  return createRateLimit(database).recordAndCheck({ identifier, ip, now })
}

function resetLoginAttemptsForIdentifier(
  database: DrizzleD1Database<typeof schema>,
  identifier: string,
) {
  return createRateLimit(database).resetForIdentifier({ identifier })
}

/**
 * bun:sqlite の drizzle には D1 の db.batch が無い。recordAndCheckLoginAttempt の atomic 書込を
 * 逐次実行で代替する shim (他の db テストと同じ運用)。D1 は 1 database につき単一の SQLite 接続を
 * 直列実行するため、db.batch 呼び出しどうしは互いに割り込まない。この shim もキューで直列化し、
 * 並列 burst のテストが呼び出し順どおりに 1 件ずつ処理されるようにする
 * (呼び出し元が Promise.all で同時に発火しても、実際の DB 書込順は各呼び出しが db.batch に
 * 到達した順=配列順になる)。
 */
function addBatch(database: DrizzleD1Database<typeof schema>) {
  let batchQueue: Promise<unknown> = Promise.resolve()
  const withBatch = database as unknown as {
    batch: (statements: ReadonlyArray<PromiseLike<unknown>>) => Promise<unknown[]>
  }
  withBatch.batch = (statements) => {
    const run = batchQueue.then(() => Promise.all(statements))
    batchQueue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
addBatch(db)

function countRows(identifier: string): number {
  const row = sqlite
    .query("SELECT count(*) as total FROM system_authentication_attempts WHERE identifier = ?")
    .get(identifier) as { total: number }

  return row.total
}

afterEach(() => {
  sqlite.exec("DELETE FROM system_authentication_attempts")
})

describe("loginRateLimitKey", () => {
  test("ip 無しは anonymous にフォールバック", () => {
    expect(loginRateLimitKey(null, "user@example.com")).toBe("anonymous|user@example.com")
  })

  test("空文字も anonymous にフォールバック", () => {
    expect(loginRateLimitKey("", "user@example.com")).toBe("anonymous|user@example.com")
  })

  test("builder は正規化しない（呼び出し側が正規化済みで渡す前提）", () => {
    /**
     * 社員番号の大文字を潰さないため builder では小文字化しない。呼び出し側 (login) が
     * メールは小文字化・社員番号は trim のみで正規化した識別子を渡す。
     */
    expect(loginRateLimitKey("203.0.113.1", "USER@Example.com")).toBe(
      "203.0.113.1|USER@Example.com",
    )
    expect(loginRateLimitKey("203.0.113.1", "Emp-A01")).toBe("203.0.113.1|Emp-A01")
  })
})

describe("internalVerifyRateLimitKey", () => {
  test("internal-verify 名前空間で IP + userId を結合する", () => {
    expect(internalVerifyRateLimitKey("203.0.113.1", "u_1")).toBe("internal-verify|203.0.113.1|u_1")
  })

  test("ip 無しは anonymous にフォールバック", () => {
    expect(internalVerifyRateLimitKey(null, "u_1")).toBe("internal-verify|anonymous|u_1")
  })
})

describe("isLoginRateLimited / recordLoginAttempt", () => {
  test("記録が無ければ上限に達していない", async () => {
    expect(await isLoginRateLimited(db, "k0", 0)).toBe(false)
  })

  test("失敗 10 回までは上限未満、11 回目相当で上限に達する", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect(await isLoginRateLimited(db, "k1", 0)).toBe(false)
      await recordLoginAttempt(db, "k1", 0)
    }

    expect(await isLoginRateLimited(db, "k1", 0)).toBe(true)
  })

  test("isLoginRateLimited は副作用を持たない (呼んでも行を作らない)", async () => {
    await isLoginRateLimited(db, "peek", 0)

    expect(countRows("peek")).toBe(0)
  })

  test("窓境界: WINDOW_MS 直前は上限のまま、WINDOW_MS ちょうどで解ける", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await recordLoginAttempt(db, "k2", 0)
    }

    /**
     * t=0 の失敗は now < 0 + WINDOW_MS の間だけ数える (attempted_at > now - WINDOW_MS)。
     */
    expect(await isLoginRateLimited(db, "k2", WINDOW_MS - 1)).toBe(true)
    expect(await isLoginRateLimited(db, "k2", WINDOW_MS)).toBe(false)
  })

  test("上限に達した後は record せず窓外に出れば解ける (record が窓を延長しない)", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await recordLoginAttempt(db, "k3", 0)
    }

    /**
     * 呼び出し側は上限到達後 record しないので行は増えない。全行が窓外に出れば解ける。
     */
    expect(await isLoginRateLimited(db, "k3", WINDOW_MS)).toBe(false)
  })

  test("別キーは独立", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await recordLoginAttempt(db, "a", 0)
    }

    expect(await isLoginRateLimited(db, "a", 0)).toBe(true)
    expect(await isLoginRateLimited(db, "b", 0)).toBe(false)
  })

  test("記録時に同 identifier の窓外の古い行を掃除する", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await recordLoginAttempt(db, "sweep", 0)
    }
    expect(countRows("sweep")).toBe(MAX_ATTEMPTS)

    /**
     * 窓を 2 つ過ぎた時刻で 1 回記録すると、t=0 の古い行 (attempted_at <= now - WINDOW_MS) が消える。
     */
    await recordLoginAttempt(db, "sweep", 2 * WINDOW_MS)

    expect(countRows("sweep")).toBe(1)
  })
})

describe("resetLoginAttempts", () => {
  test("リセットすると上限が解け行も消える", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await recordLoginAttempt(db, "reset-me", 0)
    }
    expect(await isLoginRateLimited(db, "reset-me", 0)).toBe(true)

    await resetLoginAttempts(db, "reset-me")

    expect(await isLoginRateLimited(db, "reset-me", 0)).toBe(false)
    expect(countRows("reset-me")).toBe(0)
  })

  test("未記録キーのリセットは no-op", async () => {
    await resetLoginAttempts(db, "never-seen")

    expect(countRows("never-seen")).toBe(0)
  })
})

describe("分散カウンタ (別インスタンス = 別 isolate 相当)", () => {
  test("あるインスタンスで記録した失敗を別インスタンスが同じ窓で見る", async () => {
    /**
     * 同一 sqlite を包む 2 つの drizzle インスタンス = 同一 D1 を触る 2 つの isolate に相当する。
     */
    const dbA = drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>
    const dbB = drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>

    const writer = createRateLimit(dbA)
    const reader = createRateLimit(dbB)
    expect(writer).not.toBe(reader)
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await writer.record({ key: "shared", now: 0 })
    }

    expect(countRows("shared")).toBe(MAX_ATTEMPTS)
    expect(await reader.isLimited({ key: "shared", now: 0 })).toBe(true)
  })
})

describe("DB 障害時は fail-open", () => {
  test("system_authentication_attempts が無い DB でも throw せず判定 false・記録/リセットはエラーを記録して継続する", async () => {
    /**
     * migration 未適用の空 DB を渡すと全クエリが "no such table" になる。fail-open なので
     * 判定は false を返し、記録・リセットは throw せずログイン処理を巻き戻さない。
     */
    const bareSqlite = new Database(":memory:")
    const bareDb = drizzle(bareSqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>

    addBatch(bareDb)
    const errors = spyOn(console, "error").mockImplementation(() => undefined)
    try {
      expect(await isLoginRateLimited(bareDb, "x", 0)).toBe(false)
      await recordLoginAttempt(bareDb, "x", 0)
      await resetLoginAttempts(bareDb, "x")
      expect(await recordAndCheckLoginAttempt(bareDb, "x", null, 0)).toEqual({
        limited: false,
      })
      await resetLoginAttemptsForIdentifier(bareDb, "x")

      // 各操作の catch が実際のテーブル欠落を記録したことを確認し、正常 DB への誤接続を検出する。
      expect(errors.mock.calls.map(([message]) => message)).toEqual([
        "login rate limit check failed",
        "login rate limit record failed",
        "login rate limit reset failed",
        "login rate limit gate failed",
        "login rate limit reset failed",
      ])
      for (const [, error] of errors.mock.calls) {
        expect(error).toBeInstanceOf(Error)
        expect(String(error)).toContain("no such table: system_authentication_attempts")
      }
    } finally {
      errors.mockRestore()
      bareSqlite.close()
    }
  })
})

describe("recordAndCheckLoginAttempt (原子的 3 バケットゲート)", () => {
  test.each([
    { name: "空の identifier", identifier: "", ip: "203.0.113.1" },
    { name: "2049 文字の identifier", identifier: "a".repeat(2049), ip: "203.0.113.1" },
    { name: "256 文字の ip", identifier: "user@example.com", ip: "a".repeat(256) },
    { name: "NUL だけの identifier", identifier: "\u0000", ip: "203.0.113.1" },
    { name: "NUL で始まる identifier", identifier: "\u0000user@example.com", ip: "203.0.113.1" },
    { name: "NUL を含む identifier", identifier: "user\u0000@example.com", ip: "203.0.113.1" },
    { name: "NUL を含む ip", identifier: "user@example.com", ip: "\u0000203.0.113.1" },
  ])("$name は DB に触らず拒否する", async ({ identifier, ip }) => {
    const errors = spyOn(console, "error").mockImplementation(() => undefined)
    const insert = spyOn(db, "insert")
    const select = spyOn(db, "select")
    const batch = spyOn(db, "batch")
    try {
      expect(await rateLimit.recordAndCheck({ identifier, ip, now: 0 })).toEqual({ limited: true })
      expect(
        sqlite.query("SELECT count(*) AS total FROM system_authentication_attempts").get(),
      ).toEqual({ total: 0 })
      expect(insert).not.toHaveBeenCalled()
      expect(select).not.toHaveBeenCalled()
      expect(batch).not.toHaveBeenCalled()
      expect(errors).not.toHaveBeenCalled()
    } finally {
      errors.mockRestore()
      insert.mockRestore()
      select.mockRestore()
      batch.mockRestore()
    }
  })

  test("上限の 2048 文字の identifier と 255 文字の ip は記録する", async () => {
    const identifier = "a".repeat(2048)
    expect(await rateLimit.recordAndCheck({ identifier, ip: "a".repeat(255), now: 0 })).toEqual({
      limited: false,
    })
    expect(countRows(identifier)).toBe(1)
  })

  test("同一 pair (IP+識別子) は 10 回まで許可、11 回目で拒否される", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const result = await recordAndCheckLoginAttempt(db, "pair@example.com", "10.0.0.1", 0)
      expect(result.limited).toBe(false)
    }

    const blocked = await recordAndCheckLoginAttempt(db, "pair@example.com", "10.0.0.1", 0)
    expect(blocked.limited).toBe(true)
  })

  test("(a) IP を変えても同一アカウントの account バケットが効き 21 回目で拒否される", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_ACCOUNT; attempt += 1) {
      const result = await recordAndCheckLoginAttempt(
        db,
        "account@example.com",
        `10.1.0.${attempt}`,
        0,
      )
      expect(result.limited).toBe(false)
    }

    /**
     * 21 回目、初めて使う IP からでも account バケット (20) が上限に達しているため拒否される。
     */
    const blocked = await recordAndCheckLoginAttempt(db, "account@example.com", "10.1.0.99", 0)
    expect(blocked.limited).toBe(true)
  })

  test("(b) 識別子を変えても同一 IP の spray 上限(50)が効き、別 IP には波及しない", async () => {
    for (let userIndex = 0; userIndex < MAX_ATTEMPTS_PER_IP; userIndex += 1) {
      const result = await recordAndCheckLoginAttempt(
        db,
        `spray-user${userIndex}@example.com`,
        "203.0.113.9",
        0,
      )
      expect(result.limited).toBe(false)
    }

    const blockedSameIp = await recordAndCheckLoginAttempt(
      db,
      "spray-fresh@example.com",
      "203.0.113.9",
      0,
    )
    expect(blockedSameIp.limited).toBe(true)

    const allowedOtherIp = await recordAndCheckLoginAttempt(
      db,
      "spray-fresh@example.com",
      "198.51.100.1",
      0,
    )
    expect(allowedOtherIp.limited).toBe(false)
  })

  test("(c) 同一 pair への並列 burst(15発)は最大10回だけ許可され、超過分は拒否される", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        recordAndCheckLoginAttempt(db, "burst@example.com", "10.2.0.1", 0),
      ),
    )

    expect(results.filter((result) => !result.limited).length).toBe(10)
    expect(results.filter((result) => result.limited).length).toBe(5)
  })

  test("(d) 成功はカウントされない (resetLoginAttemptsForIdentifier 後、同じ pair でまた10回失敗できる)", async () => {
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await recordAndCheckLoginAttempt(db, "reset-me@example.com", "10.3.0.1", 0)
    }

    /**
     * 10 回目の試行が認証成功したとして、login.ts と同じくゲート通過後に全削除でリセットする。
     */
    await recordAndCheckLoginAttempt(db, "reset-me@example.com", "10.3.0.1", 0)
    await resetLoginAttemptsForIdentifier(db, "reset-me@example.com")

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const result = await recordAndCheckLoginAttempt(db, "reset-me@example.com", "10.3.0.1", 0)
      expect(result.limited).toBe(false)
    }
  })

  test("(e) 429 (拒否) は自分の行を残さないため窓を延長しない", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAndCheckLoginAttempt(db, "no-extend@example.com", "10.4.0.1", 0)
    }

    /**
     * 上限到達後に何度拒否されても (拒否された試行の行は削除される)、最初の失敗群だけが
     * 窓の長さを決める。ここでは窓境界の直前まで何度 429 を受けても窓は延びないことを確認する。
     */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const blocked = await recordAndCheckLoginAttempt(
        db,
        "no-extend@example.com",
        "10.4.0.1",
        WINDOW_MS - 1,
      )
      expect(blocked.limited).toBe(true)
    }

    const afterWindow = await recordAndCheckLoginAttempt(
      db,
      "no-extend@example.com",
      "10.4.0.1",
      WINDOW_MS,
    )
    expect(afterWindow.limited).toBe(false)
  })

  test("許可された試行は 1 行だけ insert される", async () => {
    await recordAndCheckLoginAttempt(db, "single@example.com", "10.5.0.1", 0)

    expect(countRows("single@example.com")).toBe(1)
  })
})

describe("resetLoginAttemptsForIdentifier", () => {
  test("該当 identifier の行を全削除する一方、同じ IP の他アカウントの行は残す", async () => {
    await recordAndCheckLoginAttempt(db, "victim@example.com", "10.6.0.1", 0)
    await recordAndCheckLoginAttempt(db, "attacker@example.com", "10.6.0.1", 0)

    await resetLoginAttemptsForIdentifier(db, "attacker@example.com")

    expect(countRows("victim@example.com")).toBe(1)
    expect(countRows("attacker@example.com")).toBe(0)
  })
})

describe("recordAndCheckPasswordReauthentication (パスワード再入力の Account 単位ゲート)", () => {
  const accountId = "6b1f4c1e-5d9a-4b5e-9f7c-2a8d3e4f5a60"
  const reauthenticationKey = `password-reauthentication|${accountId}`

  function recordAndCheckReauthentication(now: number) {
    return rateLimit.recordAndCheckPasswordReauthentication({ accountId, now })
  }

  test("ログインと同じ上限で 10 回まで許可し、11 回目を拒否する", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      expect((await recordAndCheckReauthentication(0)).limited).toBe(false)
    }

    expect((await recordAndCheckReauthentication(0)).limited).toBe(true)
    // 拒否した試行は自分の行を消すので、窓が延びない。
    expect(countRows(reauthenticationKey)).toBe(MAX_ATTEMPTS)
  })

  test("窓の経過で回復する (WINDOW_MS 直前は拒否、WINDOW_MS ちょうどで許可)", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAndCheckReauthentication(0)
    }

    expect((await recordAndCheckReauthentication(WINDOW_MS - 1)).limited).toBe(true)
    expect((await recordAndCheckReauthentication(WINDOW_MS)).limited).toBe(false)
  })

  test("並列 burst (15 発) でも許可は 10 回までで、超過分は拒否される", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => recordAndCheckReauthentication(0)),
    )

    expect(results.filter((result) => !result.limited).length).toBe(MAX_ATTEMPTS)
    expect(results.filter((result) => result.limited).length).toBe(5)
  })

  test("成功時のリセットで行が消え、また 10 回試行できる", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAndCheckReauthentication(0)
    }

    await rateLimit.resetPasswordReauthentication({ accountId })

    expect(countRows(reauthenticationKey)).toBe(0)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      expect((await recordAndCheckReauthentication(0)).limited).toBe(false)
    }
  })

  test("ログインの失敗はこのカウンタに数えない (同じ文字列を識別子に送られても数えない)", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_IP; attempt += 1) {
      await recordAndCheckLoginAttempt(db, `login-user${attempt}@example.com`, null, 0)
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_ACCOUNT; attempt += 1) {
      await recordAndCheckLoginAttempt(db, reauthenticationKey, `10.7.0.${attempt}`, 0)
    }

    expect((await recordAndCheckReauthentication(0)).limited).toBe(false)

    // 成功時のリセットも、ログインのゲートが同じ文字列の識別子で入れた行には触れない。
    await rateLimit.resetPasswordReauthentication({ accountId })
    expect(countRows(reauthenticationKey)).toBe(MAX_ATTEMPTS_PER_ACCOUNT)
  })

  test("再入力の失敗はログインのどのバケットにも数えない", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS * 3; attempt += 1) {
      await recordAndCheckReauthentication(0)
    }

    // ip 無しのログインは anonymous バケットに入る。再入力の行が数えられていれば 50 回より前に拒否される。
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_IP; attempt += 1) {
      const result = await recordAndCheckLoginAttempt(db, `spray${attempt}@example.com`, null, 0)
      expect(result.limited).toBe(false)
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const result = await recordAndCheckLoginAttempt(db, "owner@example.com", "10.8.0.1", 0)
      expect(result.limited).toBe(false)
    }
  })

  test("ログインの成功リセットは再入力のカウンタを消さない (逆も)", async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await recordAndCheckReauthentication(0)
    }
    await recordAndCheckLoginAttempt(db, "owner@example.com", "10.9.0.1", 0)

    await resetLoginAttemptsForIdentifier(db, "owner@example.com")
    expect(countRows(reauthenticationKey)).toBe(MAX_ATTEMPTS)

    await recordAndCheckLoginAttempt(db, "owner@example.com", "10.9.0.1", 0)
    await rateLimit.resetPasswordReauthentication({ accountId })
    expect(countRows("owner@example.com")).toBe(1)
  })

  test("DB 障害時はログインのゲートと同じく fail-open で許可する", async () => {
    const bareSqlite = new Database(":memory:")
    const bareDb = drizzle(bareSqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>
    addBatch(bareDb)
    const bareRateLimit = new LoginRateLimitAdapter({
      var: { database: bareDb, now: () => new Date(0) },
    })

    expect(
      (await bareRateLimit.recordAndCheckPasswordReauthentication({ accountId, now: 0 })).limited,
    ).toBe(false)
    await bareRateLimit.resetPasswordReauthentication({ accountId })
  })
})
