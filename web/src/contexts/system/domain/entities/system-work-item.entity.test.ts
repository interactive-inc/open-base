import { testAccountId } from "@system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { SystemWorkItemEntity } from "@system/domain/entities/system-work-item.entity"
import { SystemWorkItemError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemWorkActor } from "@system/domain/schemas/work/system-work-item.schema"

const owner = {
  accountId: zAccountId.parse(testAccountId("owner")),
  principalId: "22dc64f8-e30e-4634-8e10-25b9e4fa1f75",
  kind: "human",
} as const
const receiver = {
  accountId: zAccountId.parse(testAccountId("7b0593a0-2ab1-4988-8e40-e56305231514")),
  principalId: "61064c30-9351-425c-a562-c004ac792a59",
  kind: "human",
} as const
const worker = {
  accountId: zAccountId.parse(testAccountId("worker")),
  principalId: "ef083a4f-dd0a-42a8-8007-57ab6f2df095",
  kind: "agent",
} as const
const now = new Date("2026-09-08T01:00:00.000Z")

function authentication(actor: SystemWorkActor, stepUp = true) {
  return {
    tokenVersion: 0,
    credentialId: actor.kind === "agent" ? "credential:worker" : null,
    stepUpGrantId: actor.kind === "human" && stepUp ? `step-up:${actor.accountId}` : null,
  }
}

function must(result: SystemWorkItemEntity | SystemWorkItemError): SystemWorkItemEntity {
  if (result instanceof Error) throw result
  return result
}

async function create(assignee: SystemWorkActor = worker) {
  return must(
    await SystemWorkItemEntity.create({
      command: {
        kind: "create",
        id: crypto.randomUUID(),
        commandId: crypto.randomUUID(),
        expectedRevision: 0,
        reason: "Prepare the review",
        title: "Review source information",
        instructions: "Report supported observations",
        acceptanceCriteria: "A human checks the referenced evidence",
        assigneeAccountId: assignee.accountId,
        dueAt: null,
        previousRevisionId: null,
      },
      actor: owner,
      authentication: authentication(owner, false),
      recipient: assignee,
      now,
    }),
  )
}

async function change(
  item: SystemWorkItemEntity,
  kind: string,
  actor: SystemWorkActor,
  fields: Record<string, unknown> = {},
  recipient?: SystemWorkActor,
) {
  return item.transition({
    command: {
      kind,
      id: item.snapshot.id,
      commandId: crypto.randomUUID(),
      expectedRevision: item.snapshot.revision,
      reason: "Confirmed action",
      ...fields,
    },
    actor,
    authentication: authentication(actor),
    now,
    recipient,
  })
}

async function submitted(assignee: SystemWorkActor = worker) {
  const accepted = must(await change(await create(assignee), "accept", assignee))
  return must(
    await change(accepted, "submit", assignee, {
      result: { summary: "Source observations", evidence: [] },
    }),
  )
}

describe("System work responsibility and result acceptance", () => {
  test("an agent submits a result, and an independent human confirms its exact version", async () => {
    const item = await submitted()
    expect(item.snapshot.state).toBe("review_pending")
    const approved = must(
      await change(item, "approve", owner, {
        resultId: item.snapshot.result!.id,
        resultDigest: item.snapshot.result!.digest,
      }),
    )
    expect(approved.snapshot.state).toBe("completed")
    expect(approved.snapshot.actor).toEqual(owner)
    expect(approved.snapshot.result?.submittedBy).toEqual(worker)
    expect(item.snapshot.state).toBe("review_pending")
    expect(await change(approved, "cancel", owner)).toMatchObject({ kind: "conflict" })
  })

  test("the recipient must accept responsibility before the accountable human changes", async () => {
    const item = await submitted()
    const pending = must(
      await change(item, "request_handover", owner, { toAccountId: receiver.accountId }, receiver),
    )
    expect(pending.snapshot.accountable).toEqual(owner)
    const review = {
      resultId: item.snapshot.result!.id,
      resultDigest: item.snapshot.result!.digest,
    }
    expect(await change(pending, "approve", owner, review)).toMatchObject({ kind: "conflict" })
    expect(
      await change(pending, "accept_handover", owner, {
        handoverId: pending.snapshot.handover!.id,
      }),
    ).toMatchObject({ kind: "forbidden" })
    expect(
      await change(pending, "accept_handover", receiver, { handoverId: crypto.randomUUID() }),
    ).toMatchObject({ kind: "conflict" })
    const accepted = must(
      await change(pending, "accept_handover", receiver, {
        handoverId: pending.snapshot.handover!.id,
      }),
    )
    expect(accepted.snapshot.accountable).toEqual(receiver)
    expect(accepted.snapshot.result).toEqual(item.snapshot.result)
    expect(await change(accepted, "approve", owner, review)).toMatchObject({ kind: "forbidden" })
    expect(must(await change(accepted, "approve", receiver, review)).snapshot.state).toBe(
      "completed",
    )
  })

  test("declining a handover retains the original responsibility and result", async () => {
    const item = await submitted()
    const pending = must(
      await change(item, "request_handover", owner, { toAccountId: receiver.accountId }, receiver),
    )
    const declined = must(
      await change(pending, "decline_handover", receiver, {
        handoverId: pending.snapshot.handover!.id,
      }),
    )
    expect(declined.snapshot.accountable).toEqual(owner)
    expect(declined.snapshot.handover).toBeNull()
    expect(declined.snapshot.result).toEqual(item.snapshot.result)
  })

  test("neither an agent nor a human author can approve their own result", async () => {
    for (const assignee of [worker, owner]) {
      const item = await submitted(assignee)
      expect(
        await change(item, "approve", assignee, {
          resultId: item.snapshot.result!.id,
          resultDigest: item.snapshot.result!.digest,
        }),
      ).toMatchObject({ kind: "forbidden" })
    }
  })

  test("returning preserves the old result and resubmission invalidates its approval digest", async () => {
    const first = await submitted()
    const review = {
      resultId: first.snapshot.result!.id,
      resultDigest: first.snapshot.result!.digest,
    }
    const returned = must(await change(first, "return", owner, review))
    expect(returned.snapshot.state).toBe("active")
    expect(returned.snapshot.result).toEqual(first.snapshot.result)
    const second = must(
      await change(returned, "submit", worker, {
        result: { summary: "Corrected observations", evidence: [] },
      }),
    )
    expect(second.snapshot.result?.digest).not.toBe(first.snapshot.result?.digest)
    expect(await change(second, "approve", owner, review)).toMatchObject({ kind: "conflict" })
    expect(first.snapshot.result?.summary).toBe("Source observations")
  })

  test("human decisions require a step-up attestation and cannot spoof an agent as human", async () => {
    const item = await submitted()
    const command = {
      kind: "approve",
      id: item.snapshot.id,
      commandId: crypto.randomUUID(),
      expectedRevision: item.snapshot.revision,
      reason: "Confirm",
      resultId: item.snapshot.result!.id,
      resultDigest: item.snapshot.result!.digest,
    }
    expect(
      await item.transition({
        command,
        actor: owner,
        authentication: authentication(owner, false),
        now,
      }),
    ).toMatchObject({ kind: "forbidden" })
    expect(
      SystemWorkItemEntity.restore({
        ...item.snapshot,
        authentication: { ...item.snapshot.authentication, stepUpGrantId: "forged" },
      }),
    ).toMatchObject({ kind: "invalid" })
  })

  test("actor, target, command content, and normalized evidence participate in retry identity", async () => {
    const active = must(await change(await create(), "accept", worker))
    const evidence = [
      { attachmentId: "b", sha256: "b".repeat(64) },
      { attachmentId: "a", sha256: "a".repeat(64) },
    ]
    const command = {
      kind: "submit",
      id: active.snapshot.id,
      commandId: crypto.randomUUID(),
      expectedRevision: active.snapshot.revision,
      reason: "Submit",
      result: { summary: "Result", evidence },
    }
    const result = must(
      await active.transition({
        command,
        actor: worker,
        authentication: authentication(worker),
        now,
      }),
    )
    expect(
      await result.matches(
        { ...command, result: { ...command.result, evidence: evidence.toReversed() } },
        worker,
      ),
    ).toBe(true)
    expect(await result.matches({ ...command, reason: "Different" }, worker)).toBe(false)
    expect(await result.matches(command, owner)).toBe(false)
    expect(await result.matches({ ...command, id: crypto.randomUUID() }, worker)).toBe(false)
    evidence[0]!.sha256 = "c".repeat(64)
    expect(result.snapshot.result?.evidence[1]?.sha256).toBe("b".repeat(64))
    expect(Object.isFrozen(result.snapshot.result)).toBe(true)
    expect(Object.isFrozen(result.snapshot.result?.evidence[0])).toBe(true)
  })

  test("stale revisions, a backwards clock, and changes to terminal work are rejected", async () => {
    const item = await create()
    expect(await change(item, "accept", worker, { expectedRevision: 0 })).toMatchObject({
      kind: "conflict",
    })
    const command = {
      kind: "accept",
      id: item.snapshot.id,
      commandId: crypto.randomUUID(),
      expectedRevision: item.snapshot.revision,
      reason: "Accept",
    }
    expect(
      await item.transition({
        command,
        actor: worker,
        authentication: authentication(worker),
        now: new Date(now.getTime() - 1),
      }),
    ).toMatchObject({ kind: "conflict" })
    const cancelled = must(await change(item, "cancel", owner))
    expect(cancelled.snapshot.state).toBe("cancelled")
    expect(await change(cancelled, "accept", worker)).toMatchObject({ kind: "conflict" })
  })

  test("service principals, extra payload fields, duplicate evidence and machine responsibility are rejected", async () => {
    const item = await create()
    expect(SystemWorkItemEntity.restore({ ...item.snapshot, accountable: worker })).toMatchObject({
      kind: "invalid",
    })
    expect(
      SystemWorkItemEntity.restore({ ...item.snapshot, assignee: { ...worker, kind: "service" } }),
    ).toMatchObject({ kind: "invalid" })
    expect(await change(item, "accept", worker, { arbitrary: {} })).toMatchObject({
      kind: "invalid",
    })
    expect(
      await change(item, "request_handover", owner, { toAccountId: worker.accountId }, worker),
    ).toMatchObject({ kind: "invalid" })
    const active = must(await change(item, "accept", worker))
    expect(
      await change(active, "submit", worker, {
        result: {
          summary: "Result",
          evidence: [
            { attachmentId: "same", sha256: "a".repeat(64) },
            { attachmentId: "same", sha256: "b".repeat(64) },
          ],
        },
      }),
    ).toMatchObject({ kind: "invalid" })
  })

  test("restoration rejects a stored action whose state, actor or result contradicts its meaning", async () => {
    const created = await create()
    expect(SystemWorkItemEntity.restore({ ...created.snapshot, state: "active" })).toMatchObject({
      kind: "invalid",
    })
    const result = await submitted()
    expect(
      SystemWorkItemEntity.restore({
        ...result.snapshot,
        result: { ...result.snapshot.result, id: crypto.randomUUID() },
      }),
    ).toMatchObject({ kind: "invalid" })
    expect(
      SystemWorkItemEntity.restore({
        ...result.snapshot,
        actor: owner,
        authentication: authentication(owner),
      }),
    ).toMatchObject({ kind: "invalid" })
  })
})
