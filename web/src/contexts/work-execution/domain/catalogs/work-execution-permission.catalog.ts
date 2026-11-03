export const WORK_EXECUTION_PERMISSION_KEYS = [
  "work_execution:read",
  "work_execution:manage",
  "work_execution:record",
] as const
export const WORK_EXECUTION_PERMISSION_ENTRIES = WORK_EXECUTION_PERMISSION_KEYS.map((key) => ({
  key,
  category: "work-execution",
  featureKey: "work-execution",
  description: {
    "work_execution:read": "業務定義と実行履歴を参照する",
    "work_execution:manage": "業務定義を管理する",
    "work_execution:record": "担当業務の実行結果を記録する",
  }[key],
}))
