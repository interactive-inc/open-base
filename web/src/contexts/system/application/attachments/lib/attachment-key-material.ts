export type WrappedKeyMaterial = Readonly<{
  wrappedDek: string
  wrappedDekIv: string
  kekVersion: number
}>

/** AES-GCM の IV 長。全ての添付操作で共有する。 */
export const ATTACHMENT_IV_BYTE_LENGTH = 12

/** DEK 長（256bit）。 */
export const ATTACHMENT_DEK_BYTE_LENGTH = 32
