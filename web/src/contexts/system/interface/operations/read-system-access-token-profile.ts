import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"

/** System API向けの固定署名profileを読む。 */
export function readSystemAccessTokenProfile() {
  return SYSTEM_ACCESS_TOKEN_PROFILE
}
