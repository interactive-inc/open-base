import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import {
  GET as GET_DEFINITIONS,
  POST as POST_DEFINITIONS,
} from "@/contexts/company/interface/routes/company.definitions"
import { POST as POST_PROFILE } from "@/contexts/company/interface/routes/company.profile"
import { POST as POST_ORGANIZATION_CHANGE } from "@/contexts/company/interface/routes/company.organization-changes"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** Companyの公開routeへActorを合成し、両製品で同じHTTP契約を検証する。 */
export function createCompanyPlaceHttpTestClient(
  database: D1Database,
  actor = CompanyActorValue.restore({
    accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read", "company:write"],
  }),
) {
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor)
      context.set("companyClock", () => new Date("2030-06-01T00:00:00Z"))
      await next()
    })
    .onError((error, context) => {
      if (!(error instanceof CompanyHTTPException)) throw error
      return context.json({ code: error.code }, error.status)
    })
    .get("/company/definitions", ...GET_DEFINITIONS)
    .post("/company/definitions", ...POST_DEFINITIONS)
    .post("/company/profile", ...POST_PROFILE)
    .post("/company/organization-changes", ...POST_ORGANIZATION_CHANGE)
  return (props: {
    path: string
    resources?: ReadonlyArray<CompanyResourceProps>
    revision?: number
    commandId?: string
    organizationId?: string
  }) =>
    app.request(
      props.path,
      {
        method: props.resources === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": props.organizationId ?? COMPANY_DEFAULT_ORGANIZATION_ID,
          "if-match": `"${props.revision ?? 0}"`,
          "idempotency-key": props.commandId ?? `http:${props.revision ?? 0}`,
        },
        body:
          props.resources === undefined
            ? undefined
            : JSON.stringify({ reason: "Confirm place history", resources: props.resources }),
      },
      { DB: database, COMPANY_TIME_ZONE: "UTC" },
    )
}
