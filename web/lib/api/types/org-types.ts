/** /org/tree の再帰ノード。api/src/org/org-tree-node-schema.ts に対応。 */
export type OrgTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNode>
}

/** /org/departments/:code/members の要素。api/src/org/org-member-response-schema.ts に対応。 */
export type OrgMember = {
  employee_code: string
  employee_name: string
  position: string | null
  manager_employee_code: string | null
  is_manager: boolean
}

/** /org/reporting-line/:employee_code の要素。api/src/org/org-reporting-line-node-schema.ts に対応。 */
export type OrgReportingLineNode = {
  employee_code: string
  employee_name: string
  department_code: string | null
  position: string | null
  depth: number
}

/** /company/organization-units の要素。 */
export type OrgDepartmentResponse = {
  id: string
  code: string
  name: string
  parent_code: string | null
  manager_employee_code: string | null
  organization_revision: number
  as_of: string
}

export type OrgDepartmentMutationResponse = Omit<
  OrgDepartmentResponse,
  "organization_revision" | "as_of"
>

export type OrgDepartmentEditExpectation = {
  expected_organization_revision: number
  expected_as_of: string
}

/**
 * POST /company/organization-units のリクエスト本体。
 * parent_code は api 側 zValidator が .nullable().optional()
 * のため省略可・null 可（departments/route.ts）。
 */
export type OrgDepartmentCreateRequest = {
  code: string
  name: string
  parent_code?: string | null
}

/**
 * PUT /company/organization-units/:code のリクエスト本体。
 * parent_code は api 側 zValidator が .nullable().optional()
 * のため省略可・null 可（departments/[code]/route.ts）。
 */
export type OrgDepartmentUpdateRequest = OrgDepartmentEditExpectation & {
  name: string
  parent_code?: string | null
}
