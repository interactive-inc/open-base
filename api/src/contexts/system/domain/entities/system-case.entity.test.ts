import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { describe, expect, test } from "bun:test"

const CREATED_AT = new Date("2026-08-16T00:00:00.000Z")
const DIGEST = proposalDigestSchema.parse("a".repeat(64))
const OTHER_DIGEST = proposalDigestSchema.parse("b".repeat(64))
type SystemCaseInput = Parameters<typeof SystemCaseEntity.create>[0]

function caseInput(overrides: Partial<SystemCaseInput> = {}): SystemCaseInput {
  return {
    id: systemCaseIdSchema.parse(testLiteralId("case-1")),
    subject: { context: "expense", kind: "expense", id: "expense-1", version: "4" },
    proposalDigest: DIGEST,
    createdByAccountId: zAccountId.parse(testAccountId("account-1")),
    status: "pending",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }
}

function requireCase(input: SystemCaseInput): SystemCaseEntity {
  const systemCase = SystemCaseEntity.create(input)
  expect(systemCase).toBeInstanceOf(SystemCaseEntity)
  if (systemCase instanceof Error) throw systemCase

  return systemCase
}

describe("SystemCaseEntity", () => {
  test("対象版と提案digestを固定して承認後に一度だけ実行済みへ進む", () => {
    const pending = requireCase(caseInput())
    const approved = pending.decide("approved", DIGEST, new Date(CREATED_AT.getTime() + 1))
    expect(approved).toBeInstanceOf(SystemCaseEntity)
    if (approved instanceof Error) throw approved

    const executed = approved.markExecuted(DIGEST, new Date(CREATED_AT.getTime() + 2))
    expect(executed).toBeInstanceOf(SystemCaseEntity)
    if (executed instanceof Error) throw executed

    expect(executed.status).toBe("executed")
    expect(executed.markExecuted(DIGEST, new Date(CREATED_AT.getTime() + 3))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })

  test("承認対象と異なるdigest、時刻逆行、決定済み案件の再決定を拒否する", () => {
    const pending = requireCase(caseInput())
    const digestMismatch = pending.decide("approved", OTHER_DIGEST, CREATED_AT)
    const timeReversal = pending.decide("approved", DIGEST, new Date(CREATED_AT.getTime() - 1))
    const approved = pending.decide("approved", DIGEST, CREATED_AT)
    if (approved instanceof Error) throw approved

    expect(digestMismatch).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(
      digestMismatch instanceof InvalidSystemWorkflowError ? digestMismatch.reason : null,
    ).toBe("proposal_digest_mismatch")
    expect(timeReversal).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(approved.decide("rejected", DIGEST, CREATED_AT)).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })

  test("差戻しを終端判断として記録し、同じ案件の再決定を拒否する", () => {
    const pending = requireCase(caseInput())
    const returned = pending.decide("returned", DIGEST, CREATED_AT)
    expect(returned).toBeInstanceOf(SystemCaseEntity)
    if (returned instanceof Error) throw returned

    expect(returned.status).toBe("returned")
    expect(returned.decide("approved", DIGEST, CREATED_AT)).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })

  test("対象参照とDateの可変参照を保持しない", () => {
    const subject = { context: "expense", kind: "expense", id: "expense-1", version: "1" }
    const createdAt = new Date(CREATED_AT)
    const systemCase = requireCase(caseInput({ subject, createdAt, updatedAt: createdAt }))

    subject.id = "changed"
    createdAt.setUTCFullYear(2030)
    systemCase.createdAt.setUTCFullYear(2031)

    expect(systemCase.subject.id).toBe("expense-1")
    expect(systemCase.createdAt).toEqual(CREATED_AT)
    expect(Object.isFrozen(systemCase.subject)).toBe(true)
    expect(Object.isFrozen(systemCase)).toBe(true)
  })
})
