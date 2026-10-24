import { z } from "zod"

/** RotationされたSessionを一括失効するためのopaque family ID。 */
export const zSessionFamilyId = z.uuid().brand<"SessionFamilyId">()

export type SessionFamilyId = z.infer<typeof zSessionFamilyId>
