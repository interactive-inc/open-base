import { expect, test } from "bun:test"
import { isCanonicalCompanyResourceAttributes } from "@/contexts/company/domain/definitions/is-canonical-company-resource-attributes.definition"

const employment = {
  employeeId: "0f14aa5e-0dc2-4bd8-a42b-ce8d40c20d34",
  employmentType: "FULL_TIME",
  status: "ACTIVE",
}

test("契約の未記録と無期を区別し、日付の半開期間を受理する", () => {
  for (const attributes of [
    employment,
    { ...employment, contractTerm: null },
    { ...employment, contractTerm: { kind: "INDEFINITE", startsOn: "2026-01-01" } },
    {
      ...employment,
      contractTerm: { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-01-02" },
    },
  ]) {
    expect(isCanonicalCompanyResourceAttributes("employment", attributes)).toBe(true)
  }
})

test("契約区分・実在日・終了境界・閉じた属性契約を検査する", () => {
  for (const contractTerm of [
    {},
    { kind: "UNKNOWN" },
    { kind: "INDEFINITE" },
    { kind: "INDEFINITE", startsOn: "2026-02-30" },
    { kind: "INDEFINITE", startsOn: "2026-01-01", endsBefore: null },
    { kind: "FIXED_TERM", startsOn: "2026-01-01" },
    { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: null },
    { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-01-01" },
    { kind: "FIXED_TERM", startsOn: "2026-01-02", endsBefore: "2026-01-01" },
    { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-02-30" },
    { kind: "INDEFINITE", startsOn: "2026-01-01", automaticallyTerminate: true },
  ]) {
    expect(
      isCanonicalCompanyResourceAttributes("employment", { ...employment, contractTerm }),
    ).toBe(false)
  }
})
