import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { hc } from "hono/client"
import { createFactory } from "hono/factory"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { organizationProfileVersionSchema } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import {
  GET as legacyGET,
  PUT as legacyPUT,
} from "@/contexts/company/interface/routes/company.organization-profile"
import {
  GET as publicGET,
  POST as publicPOST,
} from "@/contexts/company/interface/routes/company.profile"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const sql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const viewSchema = z
  .object({
    name: z.string(),
    representativeName: z.string().nullable(),
    locale: z.string().nullable(),
    timeZone: z.string().nullable(),
    fiscalYearStartMonth: z.number().nullable(),
    version: organizationProfileVersionSchema,
  })
  .strict()
const resourceSchema = z.object({
  organizationId: z.string(),
  type: z.literal("company-profile"),
  id: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.object({
    displayName: z.string(),
    representativeName: z.string().optional(),
    locale: z.string(),
    timeZone: z.string(),
    fiscalYearStartMonth: z.number(),
  }),
})
const resourcesSchema = z.object({
  organizationId: z.string(),
  organizationRevision: z.number(),
  resources: z.array(resourceSchema),
})
const defaults = {
  name: "Confirmed Company",
  representativeName: "Confirmed Representative",
  locale: "ja-JP",
  timeZone: "Asia/Tokyo",
  fiscalYearStartMonth: 4,
  reason: "Confirmed company facts",
}

/** 両製品の全migrationと実handlerで、既存会社情報から公開履歴への接続を検証する。 */
export async function createOrganizationProfileFixture() {
  const database = await createLocalD1Database({ schema: sql })
  await execSql(
    database,
    "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('e419466c-18a7-4fec-a665-7bf591769bf4', 'active', 0, 0, 0)",
  )
  await database
    .prepare(
      `UPDATE company_organizations SET name = ?1, representative_name = ?2 WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .bind(defaults.name, defaults.representativeName)
    .run()
  const clock = { now: new Date("2026-09-07T03:00:00.000Z") }
  const actor = {
    current: CompanyActorValue.restore({
      accountId: "e419466c-18a7-4fec-a665-7bf591769bf4",
      employeeId: null,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:admin"],
    }),
  }
  const factory = createFactory<CompanyHttpEnvironment>()
  const app = factory
    .createApp()
    .use("*", async (context, next) => {
      context.set("companyActor", actor.current)
      context.set("companyClock", () => clock.now)
      await next()
    })
    .onError((error, context) => {
      if (!(error instanceof CompanyHTTPException)) throw error
      return context.json({ code: error.code, detail: error.detail }, error.status)
    })
    .get("/company/organization-profile", ...legacyGET)
    .put("/company/organization-profile", ...legacyPUT)
    .get("/company/profile", ...publicGET)
    .post("/company/profile", ...publicPOST)
  const request = (
    input: Parameters<typeof app.request>[0],
    init?: Parameters<typeof app.request>[1],
  ) => app.request(input, init, { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" })
  const client = hc<typeof app>("http://company.test", { fetch: request })
  const read = async () => {
    const response = await client.company["organization-profile"].$get()
    if (Number(response.status) !== 200) throw new Error(`profile read: ${response.status}`)
    return viewSchema.parse(await response.json())
  }
  const input = async () => ({ ...defaults, version: (await read()).version })
  const write = (body: Awaited<ReturnType<typeof input>>, key = "profile:edit") =>
    client.company["organization-profile"].$put({ header: { "idempotency-key": key }, json: body })
  const publicRead = async (effectiveOn?: string) => {
    const response = await client.company.profile.$get({
      header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
      query: effectiveOn === undefined ? {} : { effective_on: effectiveOn },
    })
    if (Number(response.status) !== 200) throw new Error(`public profile read: ${response.status}`)
    return resourcesSchema.parse(await response.json())
  }
  const publicWrite = (resource: z.infer<typeof resourceSchema>, expected: number, key: string) =>
    client.company.profile.$post({
      header: {
        "x-company-organization-id": resource.organizationId,
        "if-match": String(expected),
        "idempotency-key": key,
      },
      json: { reason: "Confirmed public profile", resources: [resource] },
    })
  const baseline = () =>
    database
      .prepare(
        `SELECT name, representative_name FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<{ name: string; representative_name: string }>()
  const state = () =>
    database
      .prepare(
        `SELECT revision, (SELECT count(*) FROM company_resource_revisions WHERE resource_type = 'company-profile') AS profiles, (SELECT count(*) FROM company_profile_change_receipts) AS receipts FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<{ revision: number; profiles: number; receipts: number }>()
  return {
    database,
    clock,
    actor,
    client,
    read,
    input,
    write,
    publicRead,
    publicWrite,
    baseline,
    state,
    defaults,
    request,
  }
}
