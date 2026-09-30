import { createClient } from "@/lib/api/hc-client"
import type { SystemDeadLetter } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/dead-letters。api は mapper を通さず view をそのまま返すので camelCase。
 */
export async function getSystemDeadLetters(): Promise<ReadonlyArray<SystemDeadLetter> | Error> {
  const client = await createClient()

  const response = await client.system["dead-letters"].$get()

  if (response.status >= 400) {
    return new Error("failed to load system dead letters")
  }

  const body = await response.json()

  return body.dead_letters.map((deadLetter) => ({
    id: deadLetter.id,
    sourceType: deadLetter.sourceType,
    sourceId: deadLetter.sourceId,
    payloadDigest: deadLetter.payloadDigest,
    reasonCode: deadLetter.reasonCode,
    attempt: deadLetter.attempt,
    recordedAt: deadLetter.recordedAt,
    requeuedJobId: deadLetter.requeuedJobId,
    requeuedAt: deadLetter.requeuedAt,
  }))
}
