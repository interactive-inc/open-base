import { identityProviderSchema } from "@system/domain/schemas/identity/identity-provider.schema"
import { describe, expect, test } from "bun:test"

describe("identityProviderSchema", () => {
  test("Systemが明示実装するproviderだけを受理する", () => {
    for (const provider of ["passkey", "google", "github", "oidc"]) {
      expect(String(identityProviderSchema.parse(provider))).toBe(provider)
    }
  })

  test.each(["", "password", "PASSKEY", "saml", "oidc:tenant-a"])(
    "未知providerを拒否する",
    (provider) => {
      expect(identityProviderSchema.safeParse(provider).success).toBe(false)
    },
  )
})
