/**
 * 導入ごとに一つだけの会社組織の ID。どの導入でも同じ既知の値を使い、変更しない。
 * 旧来の `organization:default` は migration でこの値へ置き換え、旧値を legacy_id に残した。
 */
export const COMPANY_DEFAULT_ORGANIZATION_ID = "ad4f6cb1-774b-43ae-950f-80e9bc67c66d" as const

/**
 * 導入ごとに一つだけの会社全体（最上位）の組織単位の ID。どの導入でも同じ既知の値を使い、変更しない。
 * 旧来の `company:root` は migration でこの値へ置き換え、旧値を legacy_id に残した。
 */
export const COMPANY_ROOT_ORGANIZATION_UNIT_ID = "282ccd01-cb30-4d0a-84b4-c675bbbe473c" as const
