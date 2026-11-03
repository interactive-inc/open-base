export const CUSTOMER_PERMISSION_KEYS = ["customer:read", "customer:write"] as const
export const CUSTOMER_PERMISSION_ENTRIES = CUSTOMER_PERMISSION_KEYS.map((key) => ({
  key,
  category: "customer",
  featureKey: "customer",
  description: key === "customer:read" ? "顧客台帳を参照する" : "顧客台帳を管理する",
}))
