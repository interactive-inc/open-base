import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { isExcludedDecisionParticipant } from "@/contexts/company/domain/policies/is-excluded-decision-participant.policy"
import { describe, expect, test } from "bun:test"

const requester = restoreWorkforceId("employee", "00000000-0000-4000-8000-000000000001")
const target = restoreWorkforceId("employee", "00000000-0000-4000-8000-000000000002")
const approver = restoreWorkforceId("employee", "00000000-0000-4000-8000-000000000003")
const otherDelegate = restoreWorkforceId("employee", "00000000-0000-4000-8000-000000000004")
const excludedEmployeeIds = new Set([requester, target])

describe("isExcludedDecisionParticipant", () => {
  test("承認者から委任を受けた人事発令の対象者は、代理でも判断できない", () => {
    expect(
      isExcludedDecisionParticipant({
        actorEmployeeId: target,
        representedEmployeeId: approver,
        excludedEmployeeIds,
      }),
    ).toBe(true)
  })

  test("承認者から委任を受けた申請者は、代理でも判断できない", () => {
    expect(
      isExcludedDecisionParticipant({
        actorEmployeeId: requester,
        representedEmployeeId: approver,
        excludedEmployeeIds,
      }),
    ).toBe(true)
  })

  test("除外された判断者を代理するときも判断できない", () => {
    expect(
      isExcludedDecisionParticipant({
        actorEmployeeId: otherDelegate,
        representedEmployeeId: target,
        excludedEmployeeIds,
      }),
    ).toBe(true)
  })

  test("除外対象でない代理と判断者の組合せは判断できる", () => {
    expect(
      isExcludedDecisionParticipant({
        actorEmployeeId: otherDelegate,
        representedEmployeeId: approver,
        excludedEmployeeIds,
      }),
    ).toBe(false)
    expect(
      isExcludedDecisionParticipant({
        actorEmployeeId: approver,
        representedEmployeeId: approver,
        excludedEmployeeIds,
      }),
    ).toBe(false)
  })
})
