import { describe, expect, it } from "vite-plus/test"
import { readCompanyRevision } from "@/lib/form/read-company-revision"

describe("readCompanyRevision", () => {
  it("preserves the reviewed revision, including zero", () => {
    for (const revision of [0, 8, Number.MAX_SAFE_INTEGER]) {
      const form = new FormData()
      form.set("company_revision", revision.toString())
      expect(readCompanyRevision(form)).toBe(revision)
    }
  })

  it("rejects missing, coercible, fractional and unsafe revisions", () => {
    expect(readCompanyRevision(new FormData())).toBeInstanceOf(Error)
    for (const revision of ["", " ", "08", "-1", "1.5", "1e2", "Infinity", "9007199254740992"]) {
      const form = new FormData()
      form.set("company_revision", revision)
      expect(readCompanyRevision(form)).toBeInstanceOf(Error)
    }
  })
})
