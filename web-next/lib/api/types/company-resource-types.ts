/**
 * Company の汎用 resource route（/company/profile、/company/people 等）が返す封筒。
 * api と疎結合に保つため z.infer を参照せず同形を手書きする。
 * attributes は resource type ごとに形が違うので、各ページの `_lib/` にある
 * to*Resource 純関数が typeof 検査で絞り込む。
 */
export type CompanyResourceType =
  | "legal-entity"
  | "company-profile"
  | "site"
  | "workplace"
  | "person"
  | "employee"
  | "employment"
  | "organization-unit"
  | "assignment"
  | "reporting-relation"
  | "job"
  | "position"
  | "grade"
  | "grade-assignment"
  | "organizational-office"
  | "office-assignment"
  | "responsibility"
  | "authority-scope"
  | "responsibility-assignment"
  | "collective-body"
  | "collective-body-membership"
  | "organizational-authority"
  | "account-employee-link"
  | "personnel-action"

export type CompanyResourceState = "active" | "void"

export type CompanyResource = {
  organizationId: string
  type: CompanyResourceType
  id: string
  revision: number
  state: CompanyResourceState
  effectiveFrom: string
  effectiveTo: string | null
  attributes: Readonly<Record<string, unknown>>
}

export type CompanyResourceList = {
  organizationId: string
  organizationRevision: number
  resources: ReadonlyArray<CompanyResource>
}
