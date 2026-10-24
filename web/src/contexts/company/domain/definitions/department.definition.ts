import { z } from "zod"

/** Companyが所有する部署の最小識別・表示値。 */
export const departmentSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export type Department = z.infer<typeof departmentSchema>
