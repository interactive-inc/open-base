/** Companyの正本を会社版や基準日で読む参照に共通のクエリ。 */
export const companySnapshotQuery = {
  id: "id",
  "organization-revision": "organization_revision",
  "effective-on": "effective_on",
  "as-of": "as_of",
} as const

/** 件数と位置で区切るページ送り。 */
export const offsetPageQuery = { limit: "limit", offset: "offset" } as const
