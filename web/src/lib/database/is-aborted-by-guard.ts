const BATCH_ABORT_SENTINEL = "malformed JSON"

/**
 * ガード文（abortWhenPreviousStatementChangedNoRows）の json_extract('', '$') による
 * 意図的な abort かを判定する。これ以外の batch 失敗は本物の DB エラーとして伝播させる。
 */
export function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes(BATCH_ABORT_SENTINEL)
}
