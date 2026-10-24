import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import { z } from "zod"

const zSecretHash = z.string().regex(/^[0-9a-f]{64}$/)

/** 機械credentialとstep-up grantのraw secretを一度だけ生成し、SHA-256へ変換する。 */
export class SystemPrincipalSecretService {
  generateRawSecret(): string | Error {
    try {
      return generateOpaqueToken()
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to generate System secret")
    }
  }

  async hashRawSecret(rawSecret: string): Promise<string | Error> {
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawSecret))
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      const parsed = zSecretHash.safeParse(hex)

      return parsed.success ? parsed.data : new Error("failed to hash System secret")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to hash System secret")
    }
  }
}
