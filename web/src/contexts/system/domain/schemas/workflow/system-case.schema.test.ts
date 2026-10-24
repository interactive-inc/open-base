import {
  createSystemCaseId,
  systemCaseIdSchema,
} from "@system/domain/schemas/workflow/system-case.schema"
import { describe, expect, test } from "bun:test"

describe("SystemCaseId", () => {
  test("新規IDをUUIDとして生成し、SystemCaseIdへbrandする", () => {
    const systemCaseId = createSystemCaseId()

    expect(systemCaseIdSchema.safeParse(systemCaseId).success).toBe(true)
    expect(systemCaseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
