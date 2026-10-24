import { describe, expect, test } from "vite-plus/test"
import { parseCandidateEmployeeIds } from "@/app/(app)/system/workflow-repairs/_lib/parse-candidate-employee-ids"

describe("parseCandidateEmployeeIds", () => {
  test("parses comma or whitespace separated positive IDs and removes duplicates", () => {
    expect(parseCandidateEmployeeIds("employee:2, employee:3\nemployee:2 employee:4")).toEqual([
      "employee:2",
      "employee:3",
      "employee:4",
    ])
  })

  test("rejects invalid, empty, or over-limit candidate sets", () => {
    expect(parseCandidateEmployeeIds("")).toBeNull()
    expect(parseCandidateEmployeeIds("x".repeat(129))).toBeNull()
    expect(
      parseCandidateEmployeeIds(
        Array.from({ length: 21 }, (_, index) => `employee:${index + 1}`).join(","),
      ),
    ).toBeNull()
  })
})
