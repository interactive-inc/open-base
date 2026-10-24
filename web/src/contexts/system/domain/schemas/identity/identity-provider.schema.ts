import { z } from "zod"

/** Identity bindingの認証方式。未知providerはcodeとmigrationなしに受理しない。 */
export const identityProviderSchema = z.enum(["password", "google", "github", "oidc"])

export type IdentityProvider = z.infer<typeof identityProviderSchema>
