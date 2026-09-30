export type SystemJsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<SystemJsonValue>
  | { readonly [key: string]: SystemJsonValue }
