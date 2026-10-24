import type { ApiCompositionPermissionKey } from "@/api/http/permissions/api-composition-permission-key.catalog"

type PermissionEntry = {
  key: ApiCompositionPermissionKey
  category: string
  featureKey: string | null
  description: string
  reason: string
}

/**
 * API compositionに残る権限の表示メタデータ。
 * reasonはその権限をApp contextへ移さずここへ残す理由で、どこが判定しているかを書く。
 * featureKeyは機能ゲートの登録名。nullは機能ゲートの対象外を表す。
 */
export const API_COMPOSITION_PERMISSION_ENTRIES = [
  {
    key: "application_template:manage",
    category: "application",
    featureKey: null,
    description: "申請テンプレートを管理する",
    reason: "Systemのprocedureとcaseを複数contextが共有する汎用手続き",
  },
  {
    key: "application:approve",
    category: "application",
    featureKey: null,
    description: "組織スコープ内の互換申請を承認・却下する",
    reason: "Systemのprocedureとcaseを複数contextが共有する汎用手続き",
  },
  {
    key: "application:read:all",
    category: "application",
    featureKey: null,
    description: "全社の申請を横断で閲覧する",
    reason: "Systemのprocedureとcaseを複数contextが共有する汎用手続き",
  },
  {
    key: "application:read:department",
    category: "application",
    featureKey: null,
    description: "同じ部署の申請を閲覧する",
    reason: "Systemのprocedureとcaseを複数contextが共有する汎用手続き",
  },
  {
    key: "dashboard:view",
    category: "general",
    featureKey: null,
    description: "ダッシュボードを閲覧する",
    reason: "company.dashboard.ts が判定する横断read model",
  },
  {
    key: "employee_event:manage",
    category: "employee",
    featureKey: null,
    description: "異動・在籍イベントの履歴を記録する",
    reason: "app-base.ts が判定するCompanyの人事イベント",
  },
  {
    key: "employee_event:read:all",
    category: "employee",
    featureKey: null,
    description: "全社の異動・在籍イベント履歴を閲覧する",
    reason: "app-base.ts が判定するCompanyの人事イベント",
  },
  {
    key: "employee:archive",
    category: "employee",
    featureKey: null,
    description: "退職済み従業員をアーカイブする",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:assign_role",
    category: "employee",
    featureKey: null,
    description: "従業員のロールを割り当てる",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:create",
    category: "employee",
    featureKey: null,
    description: "従業員を登録する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:delete",
    category: "employee",
    featureKey: null,
    description: "従業員を削除する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:lifecycle:apply",
    category: "employee",
    featureKey: null,
    description: "許可された対象範囲の人事変更を確定する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:lifecycle:read:all",
    category: "employee",
    featureKey: null,
    description: "全社の人事履歴を横断で閲覧する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:lifecycle:request",
    category: "employee",
    featureKey: null,
    description: "組織スコープ内の人事変更を申請する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:read",
    category: "employee",
    featureKey: null,
    description: "従業員を閲覧する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "employee:update",
    category: "employee",
    featureKey: null,
    description: "許可された対象範囲の従業員を更新する",
    reason: "Companyが所有し、lock対象のcontextへ追加できない",
  },
  {
    key: "export:run",
    category: "iam",
    featureKey: null,
    description: "全データのエクスポートを実行する",
    reason: "全context横断のexport。判定箇所が無くseedのみが参照する",
  },
  {
    key: "grade:manage",
    category: "grade",
    featureKey: null,
    description: "等級マスタと等級の割当を管理する",
    reason: "app-base.ts が判定するCompanyの等級",
  },
  {
    key: "grade:read:all",
    category: "grade",
    featureKey: null,
    description: "全社の等級を閲覧する",
    reason: "app-base.ts が判定するCompanyの等級",
  },
  {
    key: "grade:read:reports",
    category: "grade",
    featureKey: null,
    description: "レポートライン配下の等級を閲覧する",
    reason: "app-base.ts が判定するCompanyの等級",
  },
  {
    key: "management_dashboard:view",
    category: "dashboard",
    featureKey: "management-dashboard",
    description: "経営ダッシュボードを閲覧する",
    reason: "company.dashboard.management.ts が判定する横断read model",
  },
  {
    key: "org:manage",
    category: "org",
    featureKey: null,
    description: "組織・部署を管理する",
    reason: "Companyが所有し、複数の業務contextが参照する組織構成",
  },
  {
    key: "position:manage",
    category: "position",
    featureKey: null,
    description: "役職マスタを管理する",
    reason: "Companyが所有する役職マスタ",
  },
  {
    key: "year_end_adjustment:manage",
    category: "year-end",
    featureKey: null,
    description: "年末調整の提出状況を管理する",
    reason: "所有Appが未実装。判定箇所が無くseedのみが参照する",
  },
  {
    key: "year_end_adjustment:read:all",
    category: "year-end",
    featureKey: null,
    description: "全社の年末調整の提出状況を閲覧する",
    reason: "所有Appが未実装。判定箇所が無くseedのみが参照する",
  },
] satisfies ReadonlyArray<PermissionEntry>
