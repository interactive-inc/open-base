import { createClient } from "@/lib/api/hc-client"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

type Filter = {
  q?: string | null
  dept?: string | null
}

type Params = {
  limit?: number
  offset?: number
}

/** 選択UI向けの在籍者ディレクトリ。メール・在籍区分・ロールは API から受け取らない。 */
export async function getEmployeeDirectory(filter: Filter = {}, params: Params = {}) {
  const client = await createClient()

  const response = await client.company["employee-directory"].$get({
    query: {
      q: filter.q ?? undefined,
      organization_unit: filter.dept ?? undefined,
      limit: params.limit === undefined ? undefined : String(params.limit),
      offset: params.offset === undefined ? undefined : String(params.offset),
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee directory")
  }

  const body = await response.json()

  return {
    items: body.data.map(
      (employee): EmployeeListItem => ({
        code: employee.code,
        name: employee.name,
        deptName: employee.organization_unit_name,
        position: employee.position,
        email: "",
        status: "active",
      }),
    ),
    total: body.total,
  }
}
