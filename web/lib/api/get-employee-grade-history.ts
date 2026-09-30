import { getEmployeeByCode } from "@/lib/api/get-employee-by-code"
import { getGradeAssignmentHistory } from "@/lib/api/get-grade-assignment-history"
import { getGradeAwardArchive } from "@/lib/api/get-grade-award-archive"

/** 従業員の確認済み会社版に履歴全ページを固定し、原記録は別の証跡として返す。 */
export async function getEmployeeGradeHistory(code: string) {
  const employee = await getEmployeeByCode(code)
  if (employee instanceof Error) return employee
  if (employee === null || employee.profile === null)
    return new Error("等級履歴の参照に必要な会社情報が未接続です")
  const profile = employee.profile
  const responses = await Promise.all([
    getGradeAssignmentHistory({ ...profile, offset: 0 }),
    getGradeAwardArchive(profile.employeeId),
  ])
  const first = responses[0]
  const archive = responses[1]
  if (first instanceof Error) return first
  if (archive instanceof Error) return archive
  const revisions = [...first.revisions]
  const pagination = { nextOffset: first.nextOffset }
  while (pagination.nextOffset !== null) {
    const page = await getGradeAssignmentHistory({ ...profile, offset: pagination.nextOffset })
    if (page instanceof Error) return page
    revisions.push(...page.revisions)
    pagination.nextOffset = page.nextOffset
  }
  return { companyRevision: profile.organizationRevision, revisions, archive }
}
