import {
  passwordResetTokenHashSchema,
  type PasswordResetTokenHash,
} from "@system/domain/schemas/auth/password-reset-token-hash.schema"

/** raw password reset tokenをportable Web Cryptoで一方向hash化する。 */
export async function hashPasswordResetToken(
  rawToken: string,
): Promise<PasswordResetTokenHash | Error> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken))
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
    const parsed = passwordResetTokenHashSchema.safeParse(hash)

    return parsed.success ? parsed.data : new Error("failed to hash password reset token")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to hash password reset token")
  }
}
