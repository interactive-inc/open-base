import { SessionEntity } from "@system/domain/entities/session.entity"
import { z } from "zod"

const storageRowSchema = z
  .object({
    id: z.string(),
    account_id: z.string(),
    family_id: z.string(),
    token_hash: z.string(),
    token_version: z.number(),
    authenticated_at: z.number(),
    created_at: z.number(),
    expires_at: z.number(),
    rotated_at: z.number().nullable(),
    revoked_at: z.number().nullable(),
  })
  .strict()

/** untrustedなD1 rowをcanonical SessionEntityへfail closedに変換する。 */
export function toSystemSession(storageRow: unknown): SessionEntity | Error {
  const parsed = storageRowSchema.safeParse(storageRow)

  if (!parsed.success)
    return new Error("stored System SessionEntity is invalid", { cause: parsed.error })

  return SessionEntity.create({
    id: parsed.data.id,
    accountId: parsed.data.account_id,
    familyId: parsed.data.family_id,
    tokenHash: parsed.data.token_hash,
    tokenVersion: parsed.data.token_version,
    authenticatedAt: new Date(parsed.data.authenticated_at),
    createdAt: new Date(parsed.data.created_at),
    expiresAt: new Date(parsed.data.expires_at),
    rotatedAt: parsed.data.rotated_at === null ? null : new Date(parsed.data.rotated_at),
    revokedAt: parsed.data.revoked_at === null ? null : new Date(parsed.data.revoked_at),
  })
}
