"use server"

import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { getEmployeeLifecycleState } from "@/lib/api/get-employee-lifecycle-state"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"
import { requireAuth } from "@/lib/auth/require-auth"

/**
 * 部署メンバー追加フォームの EmployeeCombobox から呼ぶ従業員検索 Server Action。
 * GET /directory/employees（q で name/code 部分一致）をラップし、結果配列のみをクライアントへ渡す。
 * 取得失敗時は空配列を返し、未選択扱いとして送信バリデーションで弾く。
 */
export async function searchTeamMemberCandidatesAction(
  query: string,
): Promise<ReadonlyArray<EmployeeListItem>> {
  await requireAuth()

  const trimmedQuery = query.trim()

  if (trimmedQuery === "") {
    return []
  }

  const result = await getEmployeeDirectory({ q: trimmedQuery })

  if (result instanceof Error) {
    return []
  }

  return result.items
}

export type AssignmentBaseRevisions = {
  employeeRevision: number
  organizationRevision: number
}

/**
 * 配属フォームで対象従業員を選んだときに、発令の楽観ロックに使う
 * employee_revision / organization_revision を取得する Server Action。
 */
export async function getAssignmentBaseRevisionsAction(
  employeeCode: string,
): Promise<AssignmentBaseRevisions | null> {
  await requireAuth()

  const state = await getEmployeeLifecycleState(employeeCode)

  if (state instanceof Error) {
    return null
  }

  return {
    employeeRevision: state.employee_revision,
    organizationRevision: state.organization_revision,
  }
}
