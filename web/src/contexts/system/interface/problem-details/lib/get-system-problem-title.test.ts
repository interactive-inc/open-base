import { describe, expect, test } from "bun:test"
import { getSystemProblemTitle } from "@system/interface/problem-details/lib/get-system-problem-title"
import type { SystemProblemStatus } from "@system/interface/problem-details/lib/get-system-problem-title"

describe("getSystemProblemTitle", () => {
  const cases: ReadonlyArray<Readonly<{ status: SystemProblemStatus; title: string }>> = [
    { status: 400, title: "Bad Request" },
    { status: 401, title: "Unauthorized" },
    { status: 403, title: "Forbidden" },
    { status: 404, title: "Not Found" },
    { status: 409, title: "Conflict" },
    { status: 413, title: "Content Too Large" },
    { status: 415, title: "Unsupported Media Type" },
    { status: 422, title: "Unprocessable Content" },
    { status: 423, title: "Locked" },
    { status: 429, title: "Too Many Requests" },
    { status: 500, title: "Internal Server Error" },
    { status: 502, title: "Bad Gateway" },
    { status: 503, title: "Service Unavailable" },
  ]

  for (const entry of cases) {
    test(`${entry.status} uses the standard status title`, () => {
      expect(getSystemProblemTitle(entry.status)).toBe(entry.title)
    })
  }
})
