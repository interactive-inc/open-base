const directionLabels: Record<string, string> = {
  inbound: "受信",
  outbound: "送信",
  bidirectional: "双方向",
}

/** Connector と交換の向きを日本語にする。 */
export function toConnectorDirectionLabel(direction: string): string {
  return directionLabels[direction] ?? direction
}
