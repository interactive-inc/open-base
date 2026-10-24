import type {
  OidcPublicKeyValue,
  OidcSigningKeysValue,
} from "@system/domain/definitions/oauth/oidc-signing-keys.definition"

/** 署名鍵ringから公開可能なJWKだけを返す。 */
export function getOidcPublicKeys(keys: OidcSigningKeysValue): ReadonlyArray<OidcPublicKeyValue> {
  const { d: _privateCoordinate, ...active } = keys.active
  return [active, ...keys.previous]
}
