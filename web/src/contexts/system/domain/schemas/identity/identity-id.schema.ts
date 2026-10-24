import { z } from "zod"

/** Adapterが十分なentropyで生成する、正規化しないopaque Identity ID。 */
export const zIdentityId = z.uuid().brand<"IdentityId">()

export type IdentityId = z.infer<typeof zIdentityId>
