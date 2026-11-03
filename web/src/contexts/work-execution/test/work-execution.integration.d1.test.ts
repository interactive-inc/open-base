import { expect, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import {
  definitionInput,
  executionInput,
} from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionRepository } from "@/contexts/work-execution/infrastructure/repositories/work-execution.repository"

test("records only assigned agent executions and retains idempotent history after retirement", async () => {
  const fixture = await createGovernanceTaskTestContext()
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
  const repository = (accountId: string) =>
    new WorkExecutionRepository({
      database,
      accountId,
      now: new Date(),
      guards: [],
      audit: () => [],
    })
  const definitions = repository(owner.accountId)
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
  expect(await definitions.executions({ tag: "customer", limit: 10, offset: 0 })).toMatchObject([
    {
      id: run.id,
      agent_id: assigned.principalId,
      definition_id: created.id,
      definition_revision: 1,
    },
  ])
}, 60_000)
