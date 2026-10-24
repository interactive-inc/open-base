import { expect, test } from "bun:test"
import { isAbortedByGuard } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/is-aborted-by-guard"

test("公開履歴と人事発令の競合をD1のcause経由でも識別する", () => {
  expect(
    isAbortedByGuard(new Error("D1 error", { cause: new Error("company_revision_conflict") })),
  ).toBe(true)
  expect(isAbortedByGuard(new Error("company_resource_revision_conflict"))).toBe(true)
  expect(isAbortedByGuard(new Error("malformed JSON"))).toBe(true)
  expect(isAbortedByGuard(new Error("company_workforce_reference_period_conflict"))).toBe(false)
  expect(isAbortedByGuard(new Error("network unavailable"))).toBe(false)
  const cyclic = new Error("cycle")
  cyclic.cause = cyclic
  expect(isAbortedByGuard(cyclic)).toBe(false)
})
