import { expect, test } from "bun:test"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { proposalDigestSchema } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { PreparePreservedRecordCandidatesAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-candidates.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { testAccountId } from "@system/test/system-test-id.test-support"

const schema = `
CREATE TABLE system_decision_task_candidates (
  case_id TEXT, task_key TEXT, round INTEGER, candidate_account_id TEXT, source TEXT,
  evidence_context TEXT, evidence_kind TEXT, evidence_id TEXT, evidence_version TEXT,
  eligibility_digest TEXT, eligible_from INTEGER, resolved_at INTEGER
);
CREATE TABLE system_decision_task_exclusions (
  case_id TEXT, task_key TEXT, round INTEGER, excluded_account_id TEXT, reason TEXT
);`

test("保全する候補と除外理由は空でも配列として復元できる", async () => {
  const database = await createLocalD1Database({ schema })
  const result = await new PreparePreservedRecordCandidatesAdapter({
    env: { DB: database },
  }).prepare("empty")
  if (result instanceof Error) throw result
  expect(result.candidates).toEqual([])
  expect(result.exclusions).toEqual([])
  await database.batch([result.guard])
})

test("候補資格の原値と除外理由を保ち、別の案件と保存後の変更を区別する", async () => {
  const database = await createLocalD1Database({ schema })
  const candidate = zAccountId.parse(testAccountId("candidate"))
  const creator = zAccountId.parse(testAccountId("creator"))
  const digest = proposalDigestSchema.parse("a".repeat(64))
  await database
    .prepare(`INSERT INTO system_decision_task_candidates VALUES
    ('case', 'review', 1, ?1, 'primary', 'qualification', 'role', 'reviewer', '1', ?2, NULL, 1000)`)
    .bind(candidate, digest)
    .run()
  await database
    .prepare(`INSERT INTO system_decision_task_exclusions VALUES
    ('case', 'review', 1, ?1, 'creator')`)
    .bind(creator)
    .run()
  const result = await new PreparePreservedRecordCandidatesAdapter({
    env: { DB: database },
  }).prepare("case")
  if (result instanceof Error) throw result
  expect(result.candidates).toEqual([
    {
      taskKey: "review",
      round: 1,
      accountId: candidate,
      source: "primary",
      evidenceContext: "qualification",
      evidenceKind: "role",
      evidenceId: "reviewer",
      evidenceVersion: "1",
      eligibilityDigest: digest,
      eligibleFrom: null,
      resolvedAt: new Date(1000),
    },
  ])
  expect(result.exclusions).toEqual([
    { taskKey: "review", round: 1, accountId: creator, reason: "creator" },
  ])
  await database
    .prepare(`INSERT INTO system_decision_task_exclusions VALUES
    ('other', 'review', 1, ?1, 'policy')`)
    .bind(creator)
    .run()
  await database.batch([result.guard])
  await database
    .prepare(
      "UPDATE system_decision_task_candidates SET evidence_version = '2' WHERE case_id = 'case'",
    )
    .run()
  const failure = await database.batch([result.guard]).catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
})
