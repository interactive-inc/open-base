import type { ApiCommand } from "@/lib/command/types"

/** 会社の設定・本人の情報・責務の解決・機能の一覧を扱うコマンド。 */
export const companySettingCommands: Readonly<Record<string, ApiCommand>> = {
  "my-profile show": {
    summary: "本人の人物表示と編集対象の版",
    method: "GET",
    path: "/company/my-profile",
  },
  "my-profile update": {
    summary: "本人の連絡先を更新（JSON: phone、profile、reason）",
    method: "PUT",
    path: "/company/my-profile",
    data: "required",
    idempotencyKey: true,
  },
  "my-direct-reports": {
    summary: "本人が管理する直属の従業員",
    method: "GET",
    path: "/company/my-direct-reports",
  },
  "my-organization-units": {
    summary: "本人が所属する組織単位",
    method: "GET",
    path: "/company/my-organization-units",
  },
  "organization-profile show": {
    summary: "会社の基本情報",
    method: "GET",
    path: "/company/organization-profile",
  },
  "organization-profile update": {
    summary: "会社の基本情報を更新（JSON: name、representativeName、locale、timeZone など）",
    method: "PUT",
    path: "/company/organization-profile",
    data: "required",
    idempotencyKey: true,
  },
  "workforce-connection-completions list": {
    summary: "従業員とAccountの接続状態と完了の記録",
    method: "GET",
    path: "/company/workforce-connection-completions",
  },
  "workforce-connection-completions create": {
    summary: "接続の完了を記録（JSON: reason）",
    method: "POST",
    path: "/company/workforce-connection-completions",
    data: "required",
    idempotencyKey: true,
  },
  "authority-resolutions resolve": {
    summary: "責務の候補を基準日で解決（JSON: as_of、subject_employee_id、criteria）",
    method: "POST",
    path: "/company/authority-resolutions",
    organization: "flag",
    data: "required",
  },
  capabilities: {
    summary: "Company APIの機能一覧",
    method: "GET",
    path: "/company/capabilities",
  },
  features: { summary: "有効な機能", method: "GET", path: "/company/features" },
  "inbox-counts": {
    summary: "各受信箱の件数",
    method: "GET",
    path: "/company/inbox/counts",
  },
}
