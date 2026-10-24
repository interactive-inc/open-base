import { z } from "zod"

/** 元業務を参照せず、現在の開示条件で発見できる保全記録を絞る。 */
export const preservedRecordSearchSchema = z.strictObject({
  action: z.enum(["read", "export"]),
  purpose: z.string().trim().min(1).max(255),
  sourceNamespace: z
    .string()
    .regex(/^\S{1,255}$/)
    .nullable(),
  ownerContext: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,99}$/)
    .nullable(),
  recordKind: z
    .string()
    .regex(/^[a-z][a-z0-9_.:-]{0,199}$/)
    .nullable(),
  sourceRecordId: z
    .string()
    .min(1)
    .max(1000)
    .refine((value) => value.trim().length > 0)
    .nullable(),
  after: z.uuid().nullable(),
  limit: z.number().int().min(1).max(50),
})
