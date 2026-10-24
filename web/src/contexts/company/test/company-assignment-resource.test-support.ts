import { expect } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import * as adoptions from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as changes from "@/contexts/company/interface/routes/company.organization-changes"
import * as executions from "@/contexts/company/interface/routes/company.personnel-action-executions"
import * as employments from "@/contexts/company/interface/routes/company.employments"
import * as employees from "@/contexts/company/interface/routes/company.employees"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import * as assignmentAdoptions from "@/contexts/company/interface/routes/company.assignment-resource-adoptions"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
export async function createCompanyAssignmentResourceTestContext(
  databaseOverride?: D1Database,
  organizationHistory: "initialization" | "confirmed" = "initialization",
) {
  const base = await createGovernanceTaskTestContext(databaseOverride)
  let actor: CompanyActorValue | undefined = CompanyActorValue.restore({
    ...base.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (actor !== undefined) context.set("companyActor", actor)
    context.set("companyClock", () => base.at)
    context.set("database", base.context.var.database)
    context.set("auditContext", base.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app
    .get("/adoptions", ...adoptions.GET)
    .post("/adoptions", ...adoptions.POST)
    .post("/changes", ...changes.POST)
    .post("/employees", ...employees.POST)
    .post("/executions", ...executions.POST)
    .post("/employments", ...employments.POST)
    .get("/assignment-adoptions", ...assignmentAdoptions.GET)
    .post("/assignment-adoptions", ...assignmentAdoptions.POST)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, base.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const root = await base.database
    .prepare(
      "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ id: string }>()
  if (root === null) throw new Error("root missing")
  const preview = await client.adoptions.$get({ query: { organization_unit_id: root.id } })
  expect(Number(preview.status)).toBe(200)
  const body = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await preview.json())
  expect(
    Number(
      (
        await client.adoptions.$post({
          header: { "idempotency-key": "assignment-root" },
          json: {
            ...body,
            organizationUnitId: root.id,
            reason: "Confirm organization history",
            initializationConfirmation:
              organizationHistory === "initialization"
                ? {
                    startsOn: "2020-01-01",
                    evidenceReferences: [
                      {
                        context: "company",
                        kind: "confirmed-test-history",
                        id: "root-start",
                        version: "1",
                      },
                    ],
                  }
                : undefined,
          },
        })
      ).status,
    ),
  ).toBe(201)
  const employeeId = base.people[0]!.employeeId
  const employment = await base.database
    .prepare("SELECT id FROM company_employments WHERE employee_id = ?")
    .bind(employeeId)
    .first<{ id: string }>()
  if (employment === null) throw new Error("employment missing")
  const revision = await base.database
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  if (revision === null) throw new Error("revision missing")
  type Resource = Parameters<typeof client.changes.$post>[0]["json"]["resources"][number]
  const assignment: Extract<Resource, { type: "assignment" }> = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "assignment",
    id: "0a8c2e5f-3b7d-4e19-8c6a-5d2f9b1e7a40",
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: {
      employeeId,
      employmentId: employment.id,
      organizationUnitId: root.id,
      assignmentType: "PRIMARY",
      positionTitle: "Coordinator",
    },
  }
  const write = (
    resources: Resource[] = [assignment],
    expectedRevision = revision,
    key = "assignment-write",
  ) =>
    client.changes.$post({
      header: {
        "idempotency-key": key,
        "if-match": String(expectedRevision),
        "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
      },
      json: { reason: "Confirm assignment", resources },
    })
  const read = (date: string) =>
    new CompanyEmployeeDirectoryReadAdapter({
      env: { ...base.context.env, NOW: `${date}T00:00:00Z` },
    }).findById(employeeId)
  const persisted = () =>
    base.database
      .prepare(`SELECT
    (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS company_revision,
    (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1) AS organization_revision,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_organization_assignment_period_versions) AS periods,
    (SELECT count(*) FROM company_assignment_period_bindings) AS bindings,
    (SELECT count(*) FROM company_command_receipts) AS receipts,
    (SELECT count(*) FROM company_personnel_actions) AS actions,
    (SELECT count(*) FROM company_employment_period_versions) AS employments,
    (SELECT count(*) FROM company_lifecycle_outbox_entries) AS outbox`)
      .first()
  const personnel = async (input: PersonnelActionInput, key: string, targetId = employeeId) => {
    const context = { ...base.context, env: { ...base.context.env, NOW: "2030-06-01T00:00:00Z" } }
    const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(targetId)
    if (revisions instanceof Error) throw revisions
    return new DirectPersonnelActionAdapter(context).apply({
      session: {
        accountId: zAccountId.parse(base.creator.accountId),
        employeeId,
        hasPermission: (permission) => permission === "employee:lifecycle:apply",
      },
      employeeId: targetId,
      idempotencyKey: key,
      expectedEmployeeRevision: revisions.employeeRevision,
      expectedOrganizationRevision: revisions.organizationRevision,
      input,
    })
  }
  const assignEmployeeCode = async (targetId = employeeId, code = "EMPLOYEE-001") => {
    const head = await base.database
      .prepare(`SELECT revision, attributes_json, effective_from FROM company_resource_heads
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'employee' AND resource_id = ?1`)
      .bind(targetId)
      .first<{ revision: number; attributes_json: string; effective_from: string }>()
    if (head === null) throw new Error("employee resource missing")
    const attributes = z.object({ personId: z.string() }).parse(JSON.parse(head.attributes_json))
    const revision = await base.database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    expect(
      Number(
        (
          await client.employees.$post({
            header: {
              "idempotency-key": `employee-code:${code}`,
              "if-match": String(revision),
              "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
            },
            json: {
              reason: "Confirm employee code",
              resources: [
                {
                  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                  type: "employee",
                  id: targetId,
                  revision: head.revision + 1,
                  state: "active",
                  effectiveFrom: head.effective_from,
                  effectiveTo: null,
                  attributes: { ...attributes, employeeCode: code },
                },
              ],
            },
          })
        ).status,
      ),
    ).toBe(201)
  }
  const companyRevision = async () => {
    const revision = await base.database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    if (revision === null) throw new Error("company revision missing")
    return revision
  }
  const publicAssignments = async (date: string) => {
    const snapshot = await new D1CompanyResourceRepository({ database: base.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  const publicReporting = async (date: string) => {
    const snapshot = await new D1CompanyResourceRepository({ database: base.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["reporting-relation"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  const initializeAssignment = async () => {
    expect(
      Number(
        (
          await write([
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "organization-unit",
              id: "0190005f-0000-7000-8000-0e0100000008",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await assignEmployeeCode()
    const source = {
      ...assignment,
      attributes: {
        ...assignment.attributes,
        organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    }
    expect(Number((await write([source], await companyRevision(), "public-start")).status)).toBe(
      201,
    )
    return source
  }
  return {
    ...base,
    setActor: (next: CompanyActorValue | undefined) => {
      actor = next
    },
    client,
    assignment,
    write,
    read,
    revision,
    root,
    persisted,
    personnel,
    assignEmployeeCode,
    companyRevision,
    publicAssignments,
    publicReporting,
    initializeAssignment,
  }
}
