import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { z } from "zod"

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u
const FILTER_FINGERPRINT_PATTERN = /^[A-Za-z0-9_-]{22}$/u
const BASE36_INTEGER_PATTERN = /^-?(?:0|[1-9a-z][0-9a-z]*)$/u

const auditCursorAnchorSchema = z.tuple([
  z
    .number()
    .int()
    .safe()
    .refine((value) => Number.isFinite(new Date(value * 1_000).getTime())),
  z.number().int().safe(),
])

export type AuditCursorAnchor = z.infer<typeof auditCursorAnchorSchema>

const auditCursorPositionSchema = z
  .strictObject({
    version: z.literal(2),
    direction: z.enum(["next", "previous"]),
    snapshotMaxId: z.number().int().safe(),
    limit: z.number().int().min(1).max(100),
    filterFingerprint: z.string().regex(FILTER_FINGERPRINT_PATTERN),
    sourceFirst: auditCursorAnchorSchema,
    sourceLast: auditCursorAnchorSchema,
    sourceHasPrevious: z.boolean(),
    sourceHasNext: z.boolean(),
    targetFirst: auditCursorAnchorSchema.nullable(),
    targetLast: auditCursorAnchorSchema.nullable(),
    targetHasPrevious: z.boolean().nullable(),
    targetHasNext: z.boolean().nullable(),
  })
  .superRefine((value, context) => {
    const targetValues = [
      value.targetFirst,
      value.targetLast,
      value.targetHasPrevious,
      value.targetHasNext,
    ]
    if (
      !targetValues.every((entry) => entry === null) &&
      targetValues.some((entry) => entry === null)
    ) {
      context.addIssue({ code: "custom", message: "target page range must be complete" })
    }
    const rangeIsDescending = (first: AuditCursorAnchor, last: AuditCursorAnchor) =>
      first[0] > last[0] || (first[0] === last[0] && first[1] >= last[1])
    if (!rangeIsDescending(value.sourceFirst, value.sourceLast)) {
      context.addIssue({ code: "custom", message: "source page range is reversed" })
    }
    if (
      value.targetFirst !== null &&
      value.targetLast !== null &&
      !rangeIsDescending(value.targetFirst, value.targetLast)
    ) {
      context.addIssue({ code: "custom", message: "target page range is reversed" })
    }
    if (
      value.sourceFirst[1] > value.snapshotMaxId ||
      value.sourceLast[1] > value.snapshotMaxId ||
      (value.targetFirst?.[1] ?? value.snapshotMaxId) > value.snapshotMaxId ||
      (value.targetLast?.[1] ?? value.snapshotMaxId) > value.snapshotMaxId
    ) {
      context.addIssue({ code: "custom", message: "page range exceeds the snapshot" })
    }
    if (
      (value.direction === "next" && !value.sourceHasNext) ||
      (value.direction === "previous" && !value.sourceHasPrevious)
    ) {
      context.addIssue({ code: "custom", message: "cursor direction is unavailable" })
    }
  })

export type AuditCursorPosition = z.infer<typeof auditCursorPositionSchema>

type PackedAuditCursor = readonly [
  2,
  "n" | "p",
  string,
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string | null,
  string | null,
  string | null,
  string | null,
  number | null,
]

function invalidCursor(cause?: unknown): CompanyValidationError {
  return new CompanyValidationError("audit cursor is invalid", "invalid_audit_cursor", { cause })
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function base64UrlToBytes(token: string): Uint8Array {
  const paddingLength = (4 - (token.length % 4)) % 4
  const base64 = token.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(paddingLength)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function encodeInteger(value: number): string {
  if (!Number.isSafeInteger(value)) throw invalidCursor()
  return value.toString(36)
}

function decodeInteger(value: unknown): number {
  if (typeof value !== "string" || !BASE36_INTEGER_PATTERN.test(value)) throw invalidCursor()

  const decoded = Number.parseInt(value, 36)
  if (!Number.isSafeInteger(decoded) || encodeInteger(decoded) !== value) throw invalidCursor()
  return decoded
}

function flags(hasPrevious: boolean, hasNext: boolean): number {
  return (hasPrevious ? 1 : 0) | (hasNext ? 2 : 0)
}

function unpackFlags(value: unknown): readonly [boolean, boolean] {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0 || value > 3) {
    throw invalidCursor()
  }
  return [(value & 1) !== 0, (value & 2) !== 0]
}

function pack(position: AuditCursorPosition): PackedAuditCursor {
  const hasTarget = position.targetFirst !== null
  return [
    2,
    position.direction === "next" ? "n" : "p",
    encodeInteger(position.snapshotMaxId),
    position.limit,
    position.filterFingerprint,
    encodeInteger(position.sourceFirst[0]),
    encodeInteger(position.sourceFirst[1]),
    encodeInteger(position.sourceLast[0]),
    encodeInteger(position.sourceLast[1]),
    flags(position.sourceHasPrevious, position.sourceHasNext),
    hasTarget ? encodeInteger(position.targetFirst?.[0] ?? 0) : null,
    hasTarget ? encodeInteger(position.targetFirst?.[1] ?? 0) : null,
    hasTarget ? encodeInteger(position.targetLast?.[0] ?? 0) : null,
    hasTarget ? encodeInteger(position.targetLast?.[1] ?? 0) : null,
    hasTarget ? flags(position.targetHasPrevious ?? false, position.targetHasNext ?? false) : null,
  ]
}

function unpack(value: unknown): AuditCursorPosition {
  if (!Array.isArray(value) || value.length !== 15) throw invalidCursor()
  const [
    version,
    direction,
    snapshotMaxId,
    limit,
    filterFingerprint,
    sourceFirstCreatedAt,
    sourceFirstId,
    sourceLastCreatedAt,
    sourceLastId,
    sourceFlags,
    targetFirstCreatedAt,
    targetFirstId,
    targetLastCreatedAt,
    targetLastId,
    targetFlags,
  ] = value
  if (version !== 2 || (direction !== "n" && direction !== "p")) throw invalidCursor()
  if (!Number.isInteger(limit) || typeof limit !== "number") throw invalidCursor()
  if (typeof filterFingerprint !== "string") throw invalidCursor()

  const [sourceHasPrevious, sourceHasNext] = unpackFlags(sourceFlags)
  const hasTarget = targetFirstCreatedAt !== null
  const targetValues = [targetFirstCreatedAt, targetFirstId, targetLastCreatedAt, targetLastId]
  if (hasTarget !== targetValues.every((entry) => entry !== null)) throw invalidCursor()
  if (hasTarget !== (targetFlags !== null)) throw invalidCursor()
  const [targetHasPrevious, targetHasNext] = hasTarget ? unpackFlags(targetFlags) : [null, null]

  const parsed = auditCursorPositionSchema.safeParse({
    version: 2,
    direction: direction === "n" ? "next" : "previous",
    snapshotMaxId: decodeInteger(snapshotMaxId),
    limit,
    filterFingerprint,
    sourceFirst: [decodeInteger(sourceFirstCreatedAt), decodeInteger(sourceFirstId)],
    sourceLast: [decodeInteger(sourceLastCreatedAt), decodeInteger(sourceLastId)],
    sourceHasPrevious,
    sourceHasNext,
    targetFirst: hasTarget
      ? [decodeInteger(targetFirstCreatedAt), decodeInteger(targetFirstId)]
      : null,
    targetLast: hasTarget
      ? [decodeInteger(targetLastCreatedAt), decodeInteger(targetLastId)]
      : null,
    targetHasPrevious,
    targetHasNext,
  })
  if (!parsed.success) throw invalidCursor(parsed.error)
  return parsed.data
}

/**
 * 監査ページカーソルの正準表現。位置情報のみを表し認可は持たない。
 * encode/decode は base64url の唯一の正準形だけを受け付ける
 */
export class AuditCursor {
  static readonly MAX_LENGTH = 256

  /** Encodes a bounded unsigned v2 page cursor in its one canonical representation. */
  static encode(position: AuditCursorPosition): string {
    const parsed = auditCursorPositionSchema.safeParse(position)
    if (!parsed.success) throw invalidCursor(parsed.error)

    const token = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(pack(parsed.data))))
    if (token.length > AuditCursor.MAX_LENGTH) throw invalidCursor()
    return token
  }

  /** Decodes only strict, canonical base64url cursor tokens. Cursors are positions, not authorization. */
  static decode(token: string): AuditCursorPosition {
    try {
      if (
        typeof token !== "string" ||
        token.length === 0 ||
        token.length > AuditCursor.MAX_LENGTH ||
        !BASE64URL_PATTERN.test(token)
      ) {
        throw invalidCursor()
      }

      const json = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        base64UrlToBytes(token),
      )
      const position = unpack(JSON.parse(json))
      if (AuditCursor.encode(position) !== token) throw invalidCursor()
      return position
    } catch (error) {
      if (error instanceof CompanyValidationError) throw error
      throw invalidCursor(error)
    }
  }
}
