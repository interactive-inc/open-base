import { describe, expect, test } from "bun:test"
import {
  evaluateSystemAccessPolicy,
  type SystemAccessPolicyInput,
} from "@system/domain/policies/evaluate-system-access.policy"

const baseInput: SystemAccessPolicyInput = {
  permissionKeys: new Set(["record:write"]),
  scopedPermissionKeys: new Map(),
  requiredPermission: "record:write",
  resourceScope: "scope:1",
  field: "amount",
  allowedFields: new Set(["amount"]),
  purpose: "correction",
  allowedPurposes: new Set(["correction"]),
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2027-01-01T00:00:00.000Z"),
  evaluatedAt: new Date("2026-06-01T00:00:00.000Z"),
  authorityEvidence: { context: "work", kind: "responsibility", id: "evidence:1", version: "7" },
  authorityRequired: true,
  separationOfDutiesSatisfied: true,
}

describe("evaluateSystemAccessPolicy", () => {
  test("全条件とauthority evidenceが揃う場合だけ許可する", () => {
    expect(evaluateSystemAccessPolicy(baseInput)).toEqual({
      allowed: true,
      reason: "allowed",
      authorityEvidence: baseInput.authorityEvidence,
    })
  })

  test("permissionとscopeをfail closedで拒否する", () => {
    const denied = evaluateSystemAccessPolicy({
      ...baseInput,
      permissionKeys: new Set(),
      scopedPermissionKeys: new Map(),
    })

    expect(denied).toEqual({ allowed: false, reason: "permission_denied", authorityEvidence: null })
    expect(
      evaluateSystemAccessPolicy({
        ...baseInput,
        permissionKeys: new Set(),
        scopedPermissionKeys: new Map([["scope:other", new Set(["record:write"])]]),
      }).reason,
    ).toBe("scope_denied")
  })

  test("field・purpose・期間・職務分離・authorityを独立に拒否する", () => {
    expect(
      evaluateSystemAccessPolicy({ ...baseInput, allowedFields: new Set(["title"]) }).reason,
    ).toBe("field_denied")
    expect(
      evaluateSystemAccessPolicy({ ...baseInput, allowedPurposes: new Set(["review"]) }).reason,
    ).toBe("purpose_denied")
    expect(
      evaluateSystemAccessPolicy({
        ...baseInput,
        evaluatedAt: new Date("2027-01-01T00:00:00.000Z"),
      }).reason,
    ).toBe("outside_validity")
    expect(
      evaluateSystemAccessPolicy({ ...baseInput, separationOfDutiesSatisfied: false }).reason,
    ).toBe("separation_of_duties_denied")
    expect(evaluateSystemAccessPolicy({ ...baseInput, authorityEvidence: null }).reason).toBe(
      "authority_required",
    )
  })
})
