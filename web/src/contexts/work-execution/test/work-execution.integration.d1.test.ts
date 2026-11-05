import { expect, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import {
  definitionInput,
  executionInput,
} from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionRepository } from "@/contexts/work-execution/infrastructure/repositories/work-execution.repository"

test("records only assigned agent executions and retains idempotent history after retirement", async () => {
  const fixture = await createGovernanceTaskTestContext(await createLocalD1Database())
  const owner = fixture.people[0]
  if (!owner) throw new Error("owner fixture unavailable")
  const database = fixture.database
  const seedAgent = async () => {
    const accountId = crypto.randomUUID()
    const principalId = crypto.randomUUID()
    await database.batch([
      database
        .prepare(
          "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?,'active',0,100,100)",
        )
        .bind(accountId),
      database
        .prepare(
          "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?,?,'agent','Example agent',1,100,100)",
        )
        .bind(principalId, accountId),
    ])
    return { accountId, principalId }
  }
  const assigned = await seedAgent()
  const unrelated = await seedAgent()
  const repository = (accountId: string, machine = true) =>
    new WorkExecutionRepository({
      database,
      accountId,
      machine,
      now: new Date(),
      guards: [],
      audit: () => [],
    })
  const definitions = repository(owner.accountId, false)
  const definition = definitionInput.parse({
    slug: "example-follow-up",
    expected_revision: 0,
    name: "Follow up",
    description: "",
    tags: ["customer"],
    agent_id: assigned.principalId,
    owner_employee_id: owner.employeeId,
    status: "active",
    reason: "Register work",
  })
  const created = await definitions.saveDefinition(definition)
  expect(await definitions.saveDefinition(definition)).toEqual(created)
  const run = executionInput.parse({
    id: crypto.randomUUID(),
    slug: definition.slug,
    definition_revision: 1,
    started_at: "2026-11-04T00:00:00.000Z",
    finished_at: "2026-11-04T00:01:00.000Z",
    outcome: "succeeded",
    summary: "Completed",
  })
  await expect(repository(unrelated.accountId).record(run)).rejects.toThrow(
    "work_execution_conflict",
  )
  const agent = repository(assigned.accountId)
  const [first, second] = await Promise.all([agent.record(run), agent.record(run)])
  expect(first).toEqual(second)
  const manual = await definitions.record({
    ...run,
    id: crypto.randomUUID(),
    ai_assisted: true,
    trigger: "scheduled",
  })
  await expect(agent.record({ ...run, summary: "Different" })).rejects.toThrow(
    "work_execution_conflict",
  )
  await definitions.saveDefinition({
    ...definition,
    expected_revision: 1,
    status: "retired",
    tags: ["archive"],
    reason: "Retire work",
  })
  expect(await agent.record(run)).toEqual(first)
  await expect(agent.record({ ...run, id: crypto.randomUUID() })).rejects.toThrow(
    "work_execution_conflict",
  )
  expect(
    await definitions.executions({
      tag: "customer",
      agent_id: assigned.principalId,
      limit: 10,
      offset: 0,
    }),
  ).toMatchObject([
    {
      id: run.id,
      agent_id: assigned.principalId,
      definition_id: created.id,
      definition_revision: 1,
    },
  ])
  expect(await definitions.executions({ slug: definition.slug, limit: 10, offset: 0 })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: manual.id,
        agent_id: null,
        reporter_account_id: owner.accountId,
        ai_assisted: true,
      }),
    ]),
  )
}, 60_000)
