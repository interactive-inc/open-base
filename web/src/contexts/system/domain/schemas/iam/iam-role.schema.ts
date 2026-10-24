import { z } from "zod"

export const iamRoleIdSchema = z.uuid().brand<"IamRoleId">()
export type IamRoleId = z.infer<typeof iamRoleIdSchema>

export const iamRoleKeySchema = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*(?::[a-z0-9][a-z0-9_-]*)+$/)
export type IamRoleKey = z.infer<typeof iamRoleKeySchema>
