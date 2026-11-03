export const OFFERING_PERMISSION_KEYS = ["offering:read", "offering:write"] as const
export const OFFERING_PERMISSION_ENTRIES = OFFERING_PERMISSION_KEYS.map((key) => ({
  key,
  category: "offering",
  featureKey: "offering",
  description:
    key === "offering:read" ? "商品・サービス台帳を参照する" : "商品・サービス台帳を管理する",
}))
