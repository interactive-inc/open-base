import { z } from "zod"

export const executionAuthorizationIdSchema = z.uuid().brand<"ExecutionAuthorizationId">()
export type ExecutionAuthorizationId = z.infer<typeof executionAuthorizationIdSchema>

/**
 * 同じ案件の実行の再送が同じ実行許可を指すよう、操作と案件から決まる UUID（RFC 9562 の version 8）を作る。
 * SHA-256 の先頭 122 bit を使い、version と variant の bit だけを固定する。
 */
export async function createExecutionAuthorizationId(
  operation: string,
  caseId: string,
): Promise<ExecutionAuthorizationId> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${operation}\u0000${caseId}`),
  )
  const hex = [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16)
  return executionAuthorizationIdSchema.parse(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  )
}
