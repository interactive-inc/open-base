import { z } from "zod"

export const procedureKeySchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_-]*$/)
  .brand<"ProcedureKey">()
export type ProcedureKey = z.infer<typeof procedureKeySchema>
