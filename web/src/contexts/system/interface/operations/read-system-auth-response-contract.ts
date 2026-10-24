import { zAppAuthAcknowledgement, zAppLogoutResponse } from "@system/interface/models/auth"

/** 認証操作の完了とlogoutの応答schemaを読む。 */
export function readSystemAuthResponseContract() {
  return { acknowledgement: zAppAuthAcknowledgement, logout: zAppLogoutResponse }
}
