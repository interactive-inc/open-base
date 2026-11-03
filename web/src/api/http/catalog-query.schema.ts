import { z } from "zod"

export const catalogQuerySchema = z
  .strictObject({
    id: z.uuid().optional(),
    search: z.string().trim().min(1).max(200).optional(),
    history: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => !query.history || query.id !== undefined)
