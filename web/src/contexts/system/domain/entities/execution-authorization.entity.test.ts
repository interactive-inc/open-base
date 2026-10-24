import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { describe, expect, test } from "bun:test"

const GRANTED_AT = new Date("2026-08-16T00:00:00.000Z")
const EXPIRES_AT = new Date("2026-08-16T00:05:00.000Z")
const DIGEST = proposalDigestSchema.parse("a".repeat(64))
const OTHER_DIGEST = proposalDigestSchema.parse("b".repeat(64))

function authorizationInput(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: testLiteralId("authorization-1"),
    caseId: testLiteralId("case-1"),
    operationKey: "apply-approved-change",
    proposalDigest: DIGEST,
    grantedToAccountId: testAccountId("service-account-1"),
    grantedAt: GRANTED_AT,
    expiresAt: EXPIRES_AT,
    usedAt: null,
    ...overrides,
  }
}

function requireAuthorization(input: unknown): ExecutionAuthorizationEntity {
  const authorization = ExecutionAuthorizationEntity.create(input)
  expect(authorization).toBeInstanceOf(ExecutionAuthorizationEntity)
  if (authorization instanceof Error) throw authorization

  return authorization
}

describe("ExecutionAuthorizationEntity", () => {
  test("承認済みdigestへ期限内に一度だけ使用できる", () => {
    const authorization = requireAuthorization(authorizationInput())
    const used = authorization.use(DIGEST, new Date(GRANTED_AT.getTime() + 1))
    expect(used).toBeInstanceOf(ExecutionAuthorizationEntity)
    if (used instanceof Error) throw used

    expect(used.use(DIGEST, new Date(GRANTED_AT.getTime() + 2))).toBeInstanceOf(
      InvalidSystemWorkflowError,
    )
  })

  test("digest差替えと期限切れ実行を拒否する", () => {
    const authorization = requireAuthorization(authorizationInput())
    const mismatch = authorization.use(OTHER_DIGEST, GRANTED_AT)
    const expired = authorization.use(DIGEST, EXPIRES_AT)

    expect(mismatch).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(mismatch instanceof InvalidSystemWorkflowError ? mismatch.reason : null).toBe(
      "proposal_digest_mismatch",
    )
    expect(expired).toBeInstanceOf(InvalidSystemWorkflowError)
    expect(expired instanceof InvalidSystemWorkflowError ? expired.reason : null).toBe(
      "authorization_expired",
    )
  })
})
