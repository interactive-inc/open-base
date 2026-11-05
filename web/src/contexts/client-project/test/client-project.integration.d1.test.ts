import { expect, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { ClientProjectRepository } from "@/contexts/client-project/infrastructure/repositories/client-project.repository"
import { clientProjectCommandSchema } from "@/contexts/client-project/domain/client-project-command"

test("records project effort, computes forecasts, and retains corrected revisions", async () => {
  const fixture = await createGovernanceTaskTestContext(await createLocalD1Database())
  const [actor, other] = fixture.people
  if (!actor || !other) throw new Error("employee fixtures are missing")
  const repository = (person: NonNullable<typeof actor>) =>
    new ClientProjectRepository({
      db: fixture.database,
      guards: [],
      accountId: person.accountId,
      employeeId: person.employeeId,
      requestId: crypto.randomUUID(),
      now: new Date("2026-11-04T00:00:00Z"),
    })
  const primary = repository(actor)
  const customerId = crypto.randomUUID()
  const projectId = crypto.randomUUID()
  const effortId = crypto.randomUUID()
  const key = crypto.randomUUID()
  const project = clientProjectCommandSchema.parse({
    id: projectId,
    kind: "project",
    expected_revision: 0,
    name: "Example Project",
    customer_id: customerId,
    owner_employee_id: actor.employeeId,
    description: "",
    status: "active",
    starts_on: null,
    due_on: null,
    planned_minutes: 120,
    remaining_minutes: 90,
    reason: "Start the project",
  })
  if (project.kind !== "project") throw new Error("project fixture is invalid")
  expect(await primary.save(project, key)).toEqual({ id: projectId, revision: 1 })
  expect(await primary.save(project, key)).toEqual({ id: projectId, revision: 1 })
  await expect(primary.save({ ...project, reason: "Different command" }, key)).rejects.toThrow(
    "idempotency_key_reused",
  )
  const effort = clientProjectCommandSchema.parse({
    id: effortId,
    kind: "effort",
    expected_revision: 0,
    project_id: projectId,
    worked_on: "2026-11-04",
    minutes: 60,
    status: "recorded",
    reason: "Record work",
  })
  await primary.save(effort, crypto.randomUUID())
  const query = { kind: "project", id: projectId, history: false, offset: 0, limit: 10 } as const
  expect((await primary.list(query))[0]).toMatchObject({
    baseline_minutes: 120,
    actual_minutes: 60,
    forecast_minutes: 150,
    variance_minutes: 30,
  })
  const correction = clientProjectCommandSchema.parse({
    ...effort,
    expected_revision: 1,
    status: "void",
    reason: "Remove duplicate work",
  })
  await expect(repository(other).save(correction, crypto.randomUUID())).rejects.toThrow(
    "client_project_write_conflict",
  )
  const attempts = await Promise.allSettled([
    primary.save(correction, crypto.randomUUID()),
    primary.save(correction, crypto.randomUUID()),
  ])
  expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1)
  expect((await primary.list(query))[0]).toMatchObject({ actual_minutes: 0, forecast_minutes: 90 })
  expect(
    await primary.list({ ...query, id: effortId, kind: "effort", history: true }),
  ).toMatchObject([
    { revision: 2, status: "void" },
    { revision: 1, status: "recorded" },
  ])
})
