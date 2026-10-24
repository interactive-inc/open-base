/** 添付DEKの破棄を申請・判断・実行できない理由。内部原因はHTTP応答へ渡さない。 */
export class AttachmentErasureError extends Error {
  constructor(
    readonly code:
      | "invalid"
      | "forbidden"
      | "not_found"
      | "already_erased"
      | "preserved"
      | "duplicate"
      | "not_approved"
      | "conflict"
      | "unavailable",
    options?: ErrorOptions,
  ) {
    super(`attachment erasure ${code}`, options)
    this.name = "AttachmentErasureError"
  }
}
