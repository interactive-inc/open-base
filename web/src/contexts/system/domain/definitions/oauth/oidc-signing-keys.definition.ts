export type OidcPublicKeyValue = Readonly<{
  kty: "EC"
  crv: "P-256"
  x: string
  y: string
  kid: string
  use: "sig"
  alg: "ES256"
}>

export type OidcSigningKeysValue = Readonly<{
  active: OidcPublicKeyValue & Readonly<{ d: string }>
  previous: ReadonlyArray<OidcPublicKeyValue>
}>
