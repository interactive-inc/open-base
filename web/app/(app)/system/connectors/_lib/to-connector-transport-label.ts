const transportLabels: Record<string, string> = {
  api: "API",
  file: "ファイル",
  webhook: "webhook",
}

/** Connector の transport を表示用の綴りにする。 */
export function toConnectorTransportLabel(transport: string): string {
  return transportLabels[transport] ?? transport
}
