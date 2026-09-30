import { expect, test } from "vite-plus/test"
import { toGradeDefinitionCommand } from "@/app/(app)/company/grades/_lib/to-grade-definition-command"

const fields = {
  commandId: "command:test",
  gradeId: "grade:test",
  companyRevision: "7",
  resourceRevision: "2",
  reason: "Confirmed correction",
  effectiveFrom: "2030-01-01",
  effectiveTo: "",
  code: "G1",
  name: "Grade",
  rank: "",
  description: "",
}

/** 実際に送信する全条件を持つフォームを構築する。 */
function form(overrides: Partial<typeof fields> = {}) {
  const input = new FormData()
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) input.set(key, value)
  return input
}

test("unknown rank remains null and the observed company/resource revisions determine a correction", () => {
  expect(toGradeDefinitionCommand(form(), "update")).toMatchObject({
    commandId: "command:test",
    expectedRevision: 7,
    reason: fields.reason,
    resource: {
      id: "grade:test",
      revision: 3,
      state: "active",
      effectiveFrom: fields.effectiveFrom,
      effectiveTo: null,
      attributes: { rank: null, description: null },
    },
  })
})
test("cancellation creates a void revision with an explicit effective date rather than deleting the record", () => {
  expect(toGradeDefinitionCommand(form(), "cancel")).toMatchObject({
    resource: { revision: 3, state: "void", effectiveFrom: fields.effectiveFrom },
  })
  expect(toGradeDefinitionCommand(form({ resourceRevision: "0" }), "create")).toMatchObject({
    resource: { revision: 1, state: "active" },
  })
})
test.each([
  { companyRevision: "" },
  { companyRevision: "-1" },
  { companyRevision: "9007199254740992" },
  { commandId: "" },
  { resourceRevision: "0" },
  { reason: "" },
  { effectiveFrom: "2030-02-30" },
  { effectiveFrom: "" },
  { effectiveTo: "2029-12-31" },
  { rank: "NaN" },
  { rank: "1.5" },
])("rejects missing or inconsistent approval conditions: %j", (invalid) => {
  expect(toGradeDefinitionCommand(form(invalid), "update")).toBeInstanceOf(Error)
})
