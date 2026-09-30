type SystemDeadLetterResponseSource = Readonly<{
  id: string
  sourceType: string
  sourceId: string
  payloadDigest: string
  reasonCode: string
  attempt: number
  recordedAt: Date
  requeuedJobId: string | null
  requeuedAt: Date | null
}>

export function systemDeadLetterResponse(deadLetter: SystemDeadLetterResponseSource) {
  return {
    id: deadLetter.id,
    source_type: deadLetter.sourceType,
    source_id: deadLetter.sourceId,
    payload_digest: deadLetter.payloadDigest,
    reason_code: deadLetter.reasonCode,
    attempt: deadLetter.attempt,
    recorded_at: deadLetter.recordedAt.toISOString(),
    requeued_job_id: deadLetter.requeuedJobId,
    requeued_at: deadLetter.requeuedAt?.toISOString() ?? null,
  }
}
