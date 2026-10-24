const statusLabels: Record<string, string> = {
  active: "有効",
  disabled: "停止",
}

/** Connector の状態を日本語にする。 */
export function toConnectorStatusLabel(status: string): string {
  return statusLabels[status] ?? status
}
