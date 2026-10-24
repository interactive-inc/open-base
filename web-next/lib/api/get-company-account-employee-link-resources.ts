import { companyOrganizationId } from "@/lib/api/company-organization-id"
import { createClient } from "@/lib/api/hc-client"
import type { CompanyResourceList } from "@/lib/api/types/company-resource-types"

/** GET /company/account-employee-links。System Account と Employee の対応を返す。 */
export async function getCompanyAccountEmployeeLinkResources(): Promise<
  CompanyResourceList | Error
> {
  const client = await createClient()

  const response = await client.company["account-employee-links"].$get({
    header: { "x-company-organization-id": companyOrganizationId },
    query: {},
  })

  if (response.status >= 400) {
    return new Error("failed to load company account employee links")
  }

  const body = await response.json()

  return {
    organizationId: body.organizationId,
    organizationRevision: body.organizationRevision,
    resources: body.resources.map((resource) => ({
      organizationId: resource.organizationId,
      type: resource.type,
      id: resource.id,
      revision: resource.revision,
      state: resource.state,
      effectiveFrom: resource.effectiveFrom,
      effectiveTo: resource.effectiveTo,
      attributes: resource.attributes,
    })),
  }
}
