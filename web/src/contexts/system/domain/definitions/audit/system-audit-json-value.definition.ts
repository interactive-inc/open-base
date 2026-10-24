export type SystemAuditJsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<SystemAuditJsonValue>
  | { readonly [key: string]: SystemAuditJsonValue }
