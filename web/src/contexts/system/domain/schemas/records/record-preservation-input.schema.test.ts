import { expect, test } from "bun:test"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"

const request = {
  reason: "Preserve original records",
  preservation: { kind: "hold", retainUntil: null, reason: "Keep evidence" },
  disclosure: {
    reason: "Restricted review",
    grants: [
      {
        accountId: "reviewer",
        actions: ["read"],
        purposes: ["review"],
        validFrom: "2026-09-13T00:00:00Z",
        validUntil: null,
      },
    ],
  },
}

test("preservation request accepts disclosure and retention choices without granting execution authority", () => {
  expect(recordPreservationRequestSchema.safeParse(request).success).toBe(true)
  expect(
    recordPreservationRequestSchema.safeParse({
      ...request,
      preservation: {
        ...request.preservation,
        kind: "retention",
        retainUntil: "2027-09-13T00:00:00Z",
      },
    }).success,
  ).toBe(true)
  for (const injected of [
    { actorAccountId: "13174c44-fe69-4065-9e59-6319c84a1f8a" },
    { source: { contentDigest: "a".repeat(64) } },
    { sourceNamespace: "another-source" },
    { sourceAuthorizationRef: { id: "another-grant" } },
    { attachmentId: crypto.randomUUID() },
    { attachmentDigest: "a".repeat(64) },
    { approved: true },
    { finalizedAt: "2026-09-13T00:00:00Z" },
    { auditEventId: crypto.randomUUID() },
    { recordId: crypto.randomUUID() },
  ])
    expect(recordPreservationRequestSchema.safeParse({ ...request, ...injected }).success).toBe(
      false,
    )
})

test("request rejects assigned policy identities, inconsistent deadlines and ambiguous disclosure grants", () => {
  for (const invalid of [
    { ...request, preservation: { ...request.preservation, id: crypto.randomUUID() } },
    { ...request, preservation: { ...request.preservation, kind: "retention" } },
    { ...request, preservation: { ...request.preservation, retainUntil: "2027-09-13T00:00:00Z" } },
    { ...request, disclosure: { ...request.disclosure, revision: 2 } },
    { ...request, disclosure: { ...request.disclosure, id: crypto.randomUUID() } },
    { ...request, disclosure: { ...request.disclosure, status: "active" } },
    {
      ...request,
      disclosure: {
        ...request.disclosure,
        grants: [...request.disclosure.grants, ...request.disclosure.grants],
      },
    },
    {
      ...request,
      disclosure: {
        ...request.disclosure,
        grants: request.disclosure.grants.map((grant) => ({
          ...grant,
          validUntil: grant.validFrom,
        })),
      },
    },
  ])
    expect(recordPreservationRequestSchema.safeParse(invalid).success).toBe(false)
})
