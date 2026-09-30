import { expect } from "bun:test"
import { z } from "zod"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { GET } from "@/contexts/company/interface/routes/company.employments"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** 元の雇用を変えず、公開APIから雇用主を確認するための会社を作る。 */
export async function createCompanyEmployerTestContext(databaseOverride?: D1Database) {
  const f = await createCompanyAssignmentResourceTestContext(databaseOverride)
  await f.assignEmployeeCode()
  const head = await f.database
    .prepare(`SELECT resource_id, revision, effective_from, effective_to, attributes_json
    FROM company_resource_heads WHERE resource_type = 'employment' AND resource_id = ?`)
    .bind(f.assignment.attributes.employmentId)
    .first<{
      resource_id: string
      revision: number
      effective_from: string
      effective_to: string | null
      attributes_json: string
    }>()
  if (head === null) throw new Error("employment missing")
  const attributes = z
    .object({
      employeeId: z.string(),
      status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
      employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
      officialName: z.string().optional(),
    })
    .parse(JSON.parse(head.attributes_json))
  const employment = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "employment" as const,
    id: head.resource_id,
    revision: head.revision + 1,
    state: "active" as const,
    effectiveFrom: head.effective_from,
    effectiveTo: head.effective_to,
    attributes: { ...attributes, employerLegalEntityId: "legal:employer" },
  }
  const legalEntity = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "legal-entity" as const,
    id: "legal:employer",
    revision: 1,
    state: "active" as const,
    effectiveFrom: head.effective_from,
    effectiveTo: null,
    attributes: {
      officialName: "Example Employer",
      jurisdictionCountryCode: "JP",
      registrationNumber: null,
      defaultCurrencyCode: "JPY",
    },
  }
  const actor = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read"],
    permissions: ["employee:read"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor)
      await next()
    })
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/employments", ...GET)
  const readEmployer = async (date: string, revision?: number) => {
    const query = new URLSearchParams({ id: employment.id, effective_on: date })
    if (revision !== undefined) query.set("organization_revision", String(revision))
    const response = await app.request(
      `/employments?${query.toString()}`,
      { headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID } },
      f.context.env,
    )
    expect(response.status).toBe(200)
    return z
      .object({
        resources: z.array(
          z.object({
            attributes: z.object({
              employerLegalEntityId: z.string().nullable().optional(),
              status: z.string(),
            }),
          }),
        ),
      })
      .parse(await response.json()).resources
  }
  return { ...f, employment, legalEntity, readEmployer }
}
