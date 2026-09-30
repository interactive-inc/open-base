import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"

/**
 * 停止した workflow の修復（担当者の付け替え）を行えるかを判定する。
 * 修復候補の一覧と実行で同じ条件を使い、「一覧には出るが実行できない」を防ぐ。
 */
export function canRepairWorkflow(session: CompanySessionValue): boolean {
  return (
    session.hasPermission("application:read:all") &&
    session.hasPermission("application_template:manage")
  )
}
