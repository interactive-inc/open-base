import { z } from "zod"

/**
 * Identity providerが発行する不透明な主体識別子。
 * 値を正規化せず、比較時は大文字小文字を区別する。
 */
export const identitySubjectSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\x20-\x7e]+$/)
  .brand<"IdentitySubject">()

export type IdentitySubject = z.infer<typeof identitySubjectSchema>
