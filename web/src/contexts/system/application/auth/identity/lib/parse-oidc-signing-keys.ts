import { oidcSigningAlgorithm } from "@system/domain/values/oauth/oidc-signing-algorithm.value"
import type { OidcSigningKeysValue } from "@system/domain/definitions/oauth/oidc-signing-keys.definition"
import { z } from "zod"

const coordinate = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const publicKey = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: coordinate,
    y: coordinate,
    kid: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
    use: z.literal("sig"),
    alg: z.literal(oidcSigningAlgorithm.toString()),
  })
  .strict()
const signingKeys = z
  .object({
    active: publicKey.extend({ d: coordinate }).strict(),
    previous: z.array(publicKey).max(2).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const keyIds = [value.active.kid, ...value.previous.map((key) => key.kid)]
    if (new Set(keyIds).size !== keyIds.length) {
      context.addIssue({ code: "custom", message: "OIDC signing key IDs must be unique" })
    }
  })

/** 環境変数のOIDC署名鍵ringを厳密に復元する。 */
export function parseOidcSigningKeys(raw: string | undefined): OidcSigningKeysValue | Error {
  if (!raw) return new Error("oidc_signing_keys_missing")

  try {
    const result = signingKeys.safeParse(JSON.parse(raw) as unknown)
    return result.success
      ? (result.data as OidcSigningKeysValue)
      : new Error("oidc_signing_keys_invalid")
  } catch {
    return new Error("oidc_signing_keys_invalid")
  }
}
