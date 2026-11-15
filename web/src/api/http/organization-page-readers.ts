import { pageApiReader } from "@/api/http/void-api-route"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import * as myOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.my-organization-units"
import * as organizationProfileRoute from "@/contexts/company/interface/routes/company.organization-profile"
import * as organizationTreeRoute from "@/contexts/company/interface/routes/company.organization-tree"
import * as organizationUnitMembersRoute from "@/contexts/company/interface/routes/company.organization-units.$code.members"
import * as organizationUnitRoute from "@/contexts/company/interface/routes/company.organization-units.$code"
import * as organizationUnitsRoute from "@/contexts/company/interface/routes/company.organization-units"

/**
 * 組織と等級の画面のloaderが、最初の表示のために読むAPI。
 * 会社の公開資源（定義、snapshot、履歴）は組織IDのヘッダーが要るため、ブラウザーで読む。
 */
export const readOrganizationTree = pageApiReader(
  "/company/organization-tree",
  organizationTreeRoute.GET,
)

export const readOrganizationUnits = pageApiReader(
  "/company/organization-units",
  organizationUnitsRoute.GET,
)

export const readOrganizationUnit = pageApiReader(
  "/company/organization-units/:code",
  organizationUnitRoute.GET,
)

export const readOrganizationUnitMembers = pageApiReader(
  "/company/organization-units/:code/members",
  organizationUnitMembersRoute.GET,
)

export const readMyOrganizationUnits = pageApiReader(
  "/company/my-organization-units",
  myOrganizationUnitsRoute.GET,
)

export const readOrganizationProfile = pageApiReader(
  "/company/organization-profile",
  organizationProfileRoute.GET,
)

/** 画面が会社の公開資源を読むときに渡す組織ID。導入ごとに一つの既知の値。 */
export function companyOrganizationId(): string {
  return COMPANY_DEFAULT_ORGANIZATION_ID
}
