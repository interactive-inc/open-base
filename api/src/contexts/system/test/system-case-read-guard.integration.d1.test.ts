import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const at = new Date("2035-01-01T00:00:00Z")

async function fixture() {
  const schema = [
    "system-core.sql",
    "system-integration.sql",
    "system-principal.sql",
    "system-workflow.sql",
    "system-procedure.sql",
    "system-procedure-delegation.sql",
  ]
    .map((name) =>
      readFileSync(new URL(`../infrastructure/schema/${name}`, import.meta.url), "utf8"),
    )
    .join("\n")
  const db = await createLocalD1Database({ schema })
  await execSql(
    db,
    "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES ('3d1063a4-6a8f-4d72-af2a-90c6e9594c0e','active',0,100,100),('f43d89f4-ac52-411f-828b-78838556ce92','active',0,100,100),('3be7ad5e-7f88-4192-b7ec-350f2f090d8d','active',0,100,100); INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES ('f43d89f4-ac52-411f-828b-78838556ce92','f43d89f4-ac52-411f-828b-78838556ce92','human','Reader',1,100,100),('3be7ad5e-7f88-4192-b7ec-350f2f090d8d','3be7ad5e-7f88-4192-b7ec-350f2f090d8d','human','Candidate',1,100,100)",
  )
  await db
    .prepare(
      "INSERT INTO system_cases(id,subject_context,subject_kind,subject_id,subject_version,proposal_digest,created_by_account_id,status,created_at,updated_at) VALUES ('4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f','records','entry','record','1',?1,'3d1063a4-6a8f-4d72-af2a-90c6e9594c0e','pending',100,100)",
    )
    .bind("a".repeat(64))
    .run()
  await db
    .prepare(
      "INSERT INTO system_decision_tasks(case_id,task_key,round,required_approvals,proposal_digest,opened_at) VALUES ('4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f','review',1,1,?1,100)",
    )
    .bind("a".repeat(64))
    .run()
  await db
    .prepare(
      "INSERT INTO system_decision_task_candidates(case_id,task_key,round,candidate_account_id,source,evidence_context,evidence_kind,evidence_id,evidence_version,eligibility_digest,resolved_at) VALUES ('4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f','review',1,'3be7ad5e-7f88-4192-b7ec-350f2f090d8d','primary','records','authority','authority','1',?1,100)",
    )
    .bind("a".repeat(64))
    .run()
  const adapter = new PrepareSystemCaseReadGuardAdapter({ env: { DB: db } })
  return {
    db,
    adapter,
    prepare: () =>
      adapter.prepare({
        caseId: "4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        accountId: "f43d89f4-ac52-411f-828b-78838556ce92",
        at,
      }),
  }
}

test.each(["case", "task", "candidate-account", "candidate-principal", "delegation"])(
  "参照後の %s の変更を、案件の開示transactionで拒否する",
  async (kind) => {
    const f = await fixture()
    await f.db
      .prepare(
        "INSERT INTO system_delegations(id,delegator_account_id,delegate_account_id,starts_at,ends_at,created_at) VALUES ('5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d','3be7ad5e-7f88-4192-b7ec-350f2f090d8d','f43d89f4-ac52-411f-828b-78838556ce92',100,?1,100)",
      )
      .bind(at.getTime() + 1000)
      .run()
    const guard = await f.prepare()
    if (guard instanceof Error) throw guard
    expect((await f.db.batch([guard(at)])).every((row) => row.success)).toBe(true)
    const sql =
      kind === "case"
        ? "UPDATE system_decision_tasks SET outcome='cancelled',closed_at=101 WHERE case_id='4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'; UPDATE system_cases SET status='cancelled',updated_at=101 WHERE id='4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'"
        : kind === "task"
          ? "UPDATE system_decision_tasks SET outcome='cancelled',closed_at=101 WHERE case_id='4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'"
          : kind === "candidate-account"
            ? "UPDATE system_accounts SET token_version=1 WHERE id='3be7ad5e-7f88-4192-b7ec-350f2f090d8d'"
            : kind === "candidate-principal"
              ? "UPDATE system_principals SET revision=2,updated_at=101 WHERE id='3be7ad5e-7f88-4192-b7ec-350f2f090d8d'"
              : "UPDATE system_delegations SET revoked_at=101 WHERE id='5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d'"
    await execSql(f.db, sql)
    expect(await f.db.batch([guard(at)]).catch((error: unknown) => error)).toBeInstanceOf(Error)
  },
)

test("委任の期限とエスカレーション開始を、記録が変わらなくても再検査する", async () => {
  const f = await fixture()
  await f.db
    .prepare(
      "INSERT INTO system_delegations(id,delegator_account_id,delegate_account_id,starts_at,ends_at,created_at) VALUES ('5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d','3be7ad5e-7f88-4192-b7ec-350f2f090d8d','f43d89f4-ac52-411f-828b-78838556ce92',100,?1,100)",
    )
    .bind(at.getTime() + 1000)
    .run()
  const guard = await f.prepare()
  if (guard instanceof Error) throw guard
  expect(
    await f.db.batch([guard(new Date(at.getTime() + 1000))]).catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  const next = await fixture()
  await next.db
    .prepare(
      "INSERT INTO system_decision_task_candidates(case_id,task_key,round,candidate_account_id,source,evidence_context,evidence_kind,evidence_id,evidence_version,eligibility_digest,eligible_from,resolved_at) VALUES ('4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f','review',1,'f43d89f4-ac52-411f-828b-78838556ce92','escalation','records','authority','authority','1',?1,?2,100)",
    )
    .bind("b".repeat(64), at.getTime() + 1000)
    .run()
  const waiting = await next.prepare()
  if (waiting instanceof Error) throw waiting
  expect(
    await next.db.batch([waiting(new Date(at.getTime() + 1000))]).catch((error: unknown) => error),
  ).toBeInstanceOf(Error)
  expect(
    await next.adapter.prepare({
      caseId: "missing",
      accountId: "f43d89f4-ac52-411f-828b-78838556ce92",
      at,
    }),
  ).toBeInstanceOf(Error)
})
