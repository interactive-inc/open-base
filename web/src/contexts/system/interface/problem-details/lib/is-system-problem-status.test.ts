import { describe, expect, test } from "bun:test"
import { isSystemProblemStatus } from "@system/interface/problem-details/lib/is-system-problem-status"

describe("isSystemProblemStatus", () => {
  test("accepts every status with a stable System title", () => {
    const statuses = [400, 401, 403, 404, 409, 413, 415, 422, 423, 429, 500, 502, 503]

    expect(statuses.every(isSystemProblemStatus)).toBe(true)
  })

  test("rejects success, redirect, and undefined error statuses", () => {
    expect([200, 302, 418, 599].some(isSystemProblemStatus)).toBe(false)
  })
})
