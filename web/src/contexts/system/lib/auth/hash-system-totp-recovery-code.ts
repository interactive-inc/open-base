import { normalizeSystemTotpRecoveryCode } from "@system/lib/auth/normalize-system-totp-recovery-code"

/** 復旧コードを保存用の hash へ変換する。正規化してから取るので、入力の揺れで一致しなくなることはない。 */
export async function hashSystemTotpRecoveryCode(input: string): Promise<string | Error> {
  const normalized = normalizeSystemTotpRecoveryCode(input)
  if (normalized === null) return new Error("recovery code is malformed")

  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`system-totp-recovery:${normalized}`),
    )

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to hash recovery code")
  }
}
