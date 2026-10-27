import { describe, expect, test } from "bun:test"
import { SystemTotpSecretCipher } from "@system/lib/auth/system-totp-secret-cipher"

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001"
const OTHER_ACCOUNT_ID = "00000000-0000-4000-8000-000000000002"

async function openCipher(keyMaterial: string) {
  const cipher = await SystemTotpSecretCipher.open(keyMaterial)
  if (cipher instanceof Error) throw cipher

  return cipher
}

describe("SystemTotpSecretCipher", () => {
  test("暗号化した秘密鍵を同じ鍵素材と Account で復号できる", async () => {
    const cipher = await openCipher("key-material")
    const sealed = await cipher.encrypt("JBSWY3DPEHPK3PXP", ACCOUNT_ID)
    if (sealed instanceof Error) throw sealed

    expect(sealed).not.toContain("JBSWY3DPEHPK3PXP")
    expect(await cipher.decrypt(sealed, ACCOUNT_ID)).toBe("JBSWY3DPEHPK3PXP")
  })

  test("同じ秘密鍵でも暗号文は毎回変わる", async () => {
    const cipher = await openCipher("key-material")

    expect(await cipher.encrypt("JBSWY3DPEHPK3PXP", ACCOUNT_ID)).not.toBe(
      await cipher.encrypt("JBSWY3DPEHPK3PXP", ACCOUNT_ID),
    )
  })

  test("別の Account の行へ移した暗号文と、別の鍵素材では復号できない", async () => {
    const cipher = await openCipher("key-material")
    const sealed = await cipher.encrypt("JBSWY3DPEHPK3PXP", ACCOUNT_ID)
    if (sealed instanceof Error) throw sealed

    expect(await cipher.decrypt(sealed, OTHER_ACCOUNT_ID)).toBeInstanceOf(Error)
    expect(await (await openCipher("other-material")).decrypt(sealed, ACCOUNT_ID)).toBeInstanceOf(
      Error,
    )
  })

  test("形の崩れた暗号文と空の鍵素材はエラーを返す", async () => {
    const cipher = await openCipher("key-material")

    expect(await cipher.decrypt("v1.only-two", ACCOUNT_ID)).toBeInstanceOf(Error)
    expect(await cipher.decrypt("v2.a.b", ACCOUNT_ID)).toBeInstanceOf(Error)
    expect(await SystemTotpSecretCipher.open("")).toBeInstanceOf(Error)
  })
})
