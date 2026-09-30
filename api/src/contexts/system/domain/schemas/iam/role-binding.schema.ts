import { permissionKeySchema } from "@system/domain/values/iam/permission.value"
import { z } from "zod"

export const roleBindingIdSchema = z.uuid().brand<"RoleBindingId">()
export type RoleBindingId = z.infer<typeof roleBindingIdSchema>

export const roleBindingResourceSchema = z
  .object({
    type: permissionKeySchema,
    id: z.string().min(1).max(255),
  })
  .strict()
export type RoleBindingResource = Readonly<z.output<typeof roleBindingResourceSchema>>
