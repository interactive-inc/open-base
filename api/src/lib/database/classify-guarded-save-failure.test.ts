import { describe, expect, test } from "bun:test"
import { classifyGuardedSaveFailure } from "@/lib/database/classify-guarded-save-failure"
import { ConflictError, UnavailableError } from "@/lib/errors"

const guard = {} as D1PreparedStatement

function database(batch: () => Promise<ReadonlyArray<{ success: boolean }>>): D1Database {
  return { batch } as unknown as D1Database
}

function failure(overrides: Partial<Parameters<typeof classifyGuardedSaveFailure>[0]> = {}) {
  return {
    database: database(async () => [{ success: true }]),
    guards: [guard],
    unchanged: async () => true,
    conflict: new ConflictError("changed", "example_changed"),
    unavailableCode: "example_save_unavailable",
    cause: new Error("audit unavailable"),
    ...overrides,
  }
}

describe("検査文を含む保存の失敗の分類", () => {
  test("検査文と状態が変わっていなければ、再送できる障害として返す", async () => {
    const result = await classifyGuardedSaveFailure(failure())
    expect(result).toBeInstanceOf(UnavailableError)
    expect(result).toMatchObject({ code: "example_save_unavailable" })
    expect(result.cause).toBeInstanceOf(Error)
  })

  test("検査文が失敗すれば競合として返す", async () => {
    const thrown = await classifyGuardedSaveFailure(
      failure({
        database: database(async () => {
          throw new Error("guard failed")
        }),
      }),
    )
    const unsuccessful = await classifyGuardedSaveFailure(
      failure({ database: database(async () => [{ success: false }]) }),
    )
    const missing = await classifyGuardedSaveFailure(
      failure({ database: database(async () => []) }),
    )
    for (const result of [thrown, unsuccessful, missing])
      expect(result).toMatchObject({ code: "example_changed" })
  })

  test("状態が変わった、または確認できなければ競合として返す", async () => {
    expect(
      await classifyGuardedSaveFailure(failure({ unchanged: async () => false })),
    ).toBeInstanceOf(ConflictError)
    expect(
      await classifyGuardedSaveFailure(
        failure({
          unchanged: async () => {
            throw new Error("read failed")
          },
        }),
      ),
    ).toBeInstanceOf(ConflictError)
  })

  test("検査文が無ければ状態だけで判断する", async () => {
    const result = await classifyGuardedSaveFailure(
      failure({
        guards: [],
        database: database(async () => {
          throw new Error("must not run")
        }),
      }),
    )
    expect(result).toBeInstanceOf(UnavailableError)
  })
})
