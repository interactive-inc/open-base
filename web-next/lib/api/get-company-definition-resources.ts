import { companyOrganizationId } from "@/lib/api/company-organization-id"
import { createClient } from "@/lib/api/hc-client"
import type { CompanyResourceList } from "@/lib/api/types/company-resource-types"

/**
 * GET /company/definitions。Site / Workplace / Job / Position / Grade /
 * OrganizationalOffice / Responsibility / AuthorityScope / CollectiveBody をまとめて返す。
 */
export async function getCompanyDefinitionResources(
  snapshot: {
    organizationRevision?: number
    effectiveOn?: string
    type?: "grade" | "position"
  } = {},
): Promise<CompanyResourceList | Error> {
  const client = await createClient()

  const response = await client.company.definitions.$get({
    header: { "x-company-organization-id": companyOrganizationId },
    query: {
      organization_revision: snapshot.organizationRevision?.toString(),
      effective_on: snapshot.effectiveOn,
      type: snapshot.type,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load company definitions")
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
