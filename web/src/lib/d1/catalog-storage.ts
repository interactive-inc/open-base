export type CatalogStorageContext = Readonly<{
  db: D1Database
  guards: ReadonlyArray<D1PreparedStatement>
  accountId: string
  requestId: string
  now: Date
  audit: (target: string, id: string, revision: number) => ReadonlyArray<D1PreparedStatement>
}>

export type CatalogQuery = Readonly<{
  id?: string
  search?: string
  history: boolean
  offset: number
  limit: number
}>
