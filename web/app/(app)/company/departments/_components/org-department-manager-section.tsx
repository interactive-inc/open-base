import { OrgDepartmentManagerList } from "@/app/(app)/company/departments/_components/org-department-manager-list"
import { FetchError } from "@/components/fetch-error"
import { listOrgDepartments } from "@/lib/api/list-org-departments"

/** 部署ノード管理セクション（GET /departments）。取得失敗時はメッセージを表示する。 */
export async function OrgDepartmentManagerSection() {
  const departments = await listOrgDepartments()

  if (departments instanceof Error) {
    return <FetchError message="部署ノードの取得に失敗しました" />
  }

  return <OrgDepartmentManagerList departments={departments} />
}
