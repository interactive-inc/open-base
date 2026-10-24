import type { SystemFeaturePermissionKey } from "@system/domain/catalogs/iam/system-feature-permission-key.catalog"

type PermissionEntry = {
  key: SystemFeaturePermissionKey
  category: string
  featureKey: null
  description: string
}

/**
 * System機能権限の表示メタデータ。
 * System権限は機能ゲートで止められないので featureKey は常に null にする。
 */
export const SYSTEM_FEATURE_PERMISSION_ENTRIES = [
  {
    key: "system:record:preserve",
    category: "records",
    featureKey: null,
    description: "承認済み内容と移管元の権限を検査して記録を保全する",
  },
  {
    key: "system:record:read",
    category: "records",
    featureKey: null,
    description: "個別の開示設定で許可された保全記録を閲覧する",
  },
  {
    key: "system:record:export",
    category: "records",
    featureKey: null,
    description: "個別の開示設定で許可された保全記録を出力する",
  },
  {
    key: "system:procedure:read",
    category: "procedure",
    featureKey: null,
    description: "自分が申請・判断した提案の履歴を閲覧する",
  },
  {
    key: "system:procedure:read:all",
    category: "procedure",
    featureKey: null,
    description: "提案履歴の閲覧範囲を全件へ広げる",
  },
  {
    key: "account:manage",
    category: "iam",
    featureKey: null,
    description: "アカウントを管理する(作成・停止・失効・identity)",
  },
  {
    key: "audit:export",
    category: "audit",
    featureKey: null,
    description: "監査イベントを CSV 出力する",
  },
  {
    key: "audit:read",
    category: "audit",
    featureKey: null,
    description: "監査イベントを閲覧する",
  },
  {
    key: "batch:view",
    category: "batch",
    featureKey: null,
    description: "バッチジョブを閲覧する",
  },
  {
    key: "notification:send",
    category: "notification",
    featureKey: null,
    description: "通知を送信する",
  },
  {
    key: "system:work:read",
    category: "work",
    featureKey: null,
    description: "参加する作業と成果を閲覧する",
  },
  { key: "system:work:create", category: "work", featureKey: null, description: "作業を依頼する" },
  {
    key: "system:work:perform",
    category: "work",
    featureKey: null,
    description: "作業を受領し成果を提出する",
  },
  {
    key: "system:work:review",
    category: "work",
    featureKey: null,
    description: "人が成果を確認し承認・差戻しする",
  },
  {
    key: "system:work:manage",
    category: "work",
    featureKey: null,
    description: "責任を引き継ぎ作業を中止する",
  },
  {
    key: "personal_data:erase",
    category: "personal_data",
    featureKey: null,
    description:
      "承認済みの消去申請に基づき、個人情報を含む添付の暗号鍵を破棄する。既定ではどのRoleにも付与しない",
  },
] satisfies ReadonlyArray<PermissionEntry>
