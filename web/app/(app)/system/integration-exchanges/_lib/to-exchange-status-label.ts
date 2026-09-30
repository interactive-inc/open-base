const statusLabels: Record<string, string> = {
  pending: "処理中",
  succeeded: "成功",
  failed: "失敗",
  cancelled: "取消",
}

/** 外部交換の状態を日本語にする。 */
export function toExchangeStatusLabel(status: string): string {
  return statusLabels[status] ?? status
}
