import { z } from "zod"

export const humanAttestationIdSchema = z.uuid().brand<"HumanAttestationId">()
export type HumanAttestationId = z.infer<typeof humanAttestationIdSchema>
