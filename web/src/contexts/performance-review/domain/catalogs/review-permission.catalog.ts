export const REVIEW_PERMISSION_KEYS = [
  "performance_review:manage",
  "performance_review:read",
  "performance_review:read:all",
  "performance_review:write",
  "performance_review:decide",
] as const
export const REVIEW_PERMISSION_ENTRIES = REVIEW_PERMISSION_KEYS.map((key) => ({
  key,
  category: "performance-review",
  featureKey: "performance-review",
  description: {
    "performance_review:manage": "評価期間と承認規程を作成する",
    "performance_review:read": "本人または判断対象の評価を読む",
    "performance_review:read:all": "全社の評価と履歴を読む",
    "performance_review:write": "本人の目標と自己評価を提出する",
    "performance_review:decide": "会社上の資格がある評価を判断する",
  }[key],
}))
