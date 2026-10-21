import { z } from "zod"

const zAppAuditLog = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  role: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.string().nullable(),
  createdAt: z.string(),
})

export const zAppAuditLogs = z.object({
  items: z.array(zAppAuditLog),
  total: z.number().int().min(0),
  /** 続きのページに渡す境界。条件に合う行が無ければ null。 */
  boundary: z.string().nullable(),
})
