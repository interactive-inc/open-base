import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const caseId = "4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f"
const delegationId = "5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d"
const delegateAccountId = zAccountId.parse("f43d89f4-ac52-411f-828b-78838556ce92")
const taskKey = "review"
const round = 1
const at = new Date("2035-01-01T00:00:00Z")

/** 候補 count 人のうち最後の 1 人が、判断する人へ委任している案件を作る。 */
async function fixture(count: number) {
  const schema = [
    "system-core.sql",
    "system-integration.sql",
    "system-principal.sql",
    "system-workflow.sql",
    "system-procedure.sql",
    "system-procedure-delegation.sql",
  ]
    .map((name) => readFileSync(new URL(`../../schema/${name}`, import.meta.url), "utf8"))
    .join("\n")
  const db = await createLocalD1Database({ schema })
  const delegator = zAccountId.parse(crypto.randomUUID())
  const candidates = [
    ...Array.from({ length: count - 1 }, () => zAccountId.parse(crypto.randomUUID())),
    delegator,
  ]
  const accounts = [delegateAccountId, ...candidates]
    .map((id) => `('${id}','active',0,100,100)`)
    .join(",")
  await execSql(
    db,
    `INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ${accounts}`,
  )
  await db
    .prepare(
      "INSERT INTO system_cases(id,subject_context,subject_kind,subject_id,subject_version,proposal_digest,created_by_account_id,status,created_at,updated_at) VALUES (?1,'records','entry','record','1',?2,?3,'pending',100,100)",
    )
    .bind(caseId, "a".repeat(64), candidates[0])
    .run()
  await db
    .prepare(
      "INSERT INTO system_delegations(id,delegator_account_id,delegate_account_id,starts_at,ends_at,created_at) VALUES (?1,?2,?3,100,?4,100)",
    )
    .bind(delegationId, delegator, delegateAccountId, at.getTime() + 1000)
    .run()
  return { adapter: new SystemD1ProposalAdapter({ env: { DB: db } }), candidates, delegator, db }
}

test.each([97, 98, 100])(
  "候補 %i 人の案件でも、委任先の代理判断の委任を解決できる",
  async (count) => {
    const { adapter, candidates, delegator } = await fixture(count)

    for (const requested of [undefined, delegationId]) {
      const delegation = await adapter.findDelegation({
        caseId,
        taskKey,
        round,
        actorAccountId: delegateAccountId,
        candidateAccountIds: candidates,
        delegationId: requested,
        at,
      })

      expect(delegation).toEqual({ id: delegationId, representedAccountId: delegator })
    }
  },
)

test("候補に委任元が含まれなければ委任を解決しない", async () => {
  const { adapter, candidates, delegator } = await fixture(100)

  expect(
    await adapter.findDelegation({
      caseId,
      taskKey,
      round,
      actorAccountId: delegateAccountId,
      candidateAccountIds: candidates.filter((candidate) => candidate !== delegator),
      at,
    }),
  ).toBeNull()
})

test("委任先がこのTaskの判断から除外されていれば、候補が多くても委任を解決しない", async () => {
  const { adapter, candidates, db } = await fixture(100)
  await db
    .prepare(
      "INSERT INTO system_decision_tasks(case_id,task_key,round,required_approvals,proposal_digest,opened_at) VALUES (?1,?2,?3,1,?4,100)",
    )
    .bind(caseId, taskKey, round, "a".repeat(64))
    .run()
  await db
    .prepare(
      "INSERT INTO system_decision_task_exclusions(case_id,task_key,round,excluded_account_id,reason) VALUES (?1,?2,?3,?4,'policy')",
    )
    .bind(caseId, taskKey, round, delegateAccountId)
    .run()

  for (const requested of [undefined, delegationId]) {
    expect(
      await adapter.findDelegation({
        caseId,
        taskKey,
        round,
        actorAccountId: delegateAccountId,
        candidateAccountIds: candidates,
        delegationId: requested,
        at,
      }),
    ).toBeNull()
  }
  // 別のTaskでは除外されていないので解決する。
  expect(
    await adapter.findDelegation({
      caseId,
      taskKey: "another",
      round,
      actorAccountId: delegateAccountId,
      candidateAccountIds: candidates,
      at,
    }),
  ).not.toBeNull()
})
