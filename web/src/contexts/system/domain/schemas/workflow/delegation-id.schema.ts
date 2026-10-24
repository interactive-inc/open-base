import { z } from "zod"

export const delegationIdSchema = z.uuid().brand<"DelegationId">()
export type DelegationId = z.infer<typeof delegationIdSchema>
