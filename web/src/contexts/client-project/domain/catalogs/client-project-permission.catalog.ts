export const CLIENT_PROJECT_PERMISSION_KEYS = [
  "client_project:read",
  "client_project:write",
  "client_project:record",
] as const

export const CLIENT_PROJECT_PERMISSION_ENTRIES = CLIENT_PROJECT_PERMISSION_KEYS.map((key) => ({
  key,
  category: "client-project",
  featureKey: "client-project",
  description: {
    "client_project:read": "クライアント案件と工数を全件参照する",
    "client_project:write": "クライアント案件を管理する",
    "client_project:record": "自分の案件工数を登録・訂正する",
  }[key],
}))
