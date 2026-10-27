import type { SystemTotpCredentialEntity } from "@system/domain/entities/system-totp-credential.entity"
import { SystemTotpSecretCipher } from "@system/lib/auth/system-totp-secret-cipher"

/** 登録に保存した暗号文から、認証アプリと共有する秘密鍵を取り出す。 */
export async function decryptSystemTotpSecret(
  credential: SystemTotpCredentialEntity,
  keyMaterial: string,
): Promise<string | Error> {
  const cipher = await SystemTotpSecretCipher.open(keyMaterial)
  if (cipher instanceof Error) return cipher

  return cipher.decrypt(credential.secretCiphertext, credential.accountId)
}
