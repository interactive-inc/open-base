import { companyOrganizationId } from "@/lib/api/company-organization-id"
import { createClient } from "@/lib/api/hc-client"
import type { CompanyResourceList } from "@/lib/api/types/company-resource-types"

type Params = {
  effectiveOn: string | null
}

/**
 * GET /company/organization-snapshots。ある時点の組織構造（OrganizationUnit、Assignment、
 * ReportingRelation、OfficeAssignment、ResponsibilityAssignment、CollectiveBodyMembership、
 * OrganizationalAuthority）をまとめて返す。effectiveOn 省略時は現在時点。
 */
export async function getCompanyOrganizationSnapshot(
  params: Params = { effectiveOn: null },
): Promise<CompanyResourceList | Error> {
  const client = await createClient()

  const response = await client.company["organization-snapshots"].$get({
    header: { "x-company-organization-id": companyOrganizationId },
    query: {
      effective_on: params.effectiveOn ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load company organization snapshot")
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
