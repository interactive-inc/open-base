const kindLabels: Record<string, string> = {
  human: "人",
  agent: "エージェント",
  service: "サービス",
  connector: "コネクタ",
}

/** Principal の分類を日本語にする。api が新しい分類を足したときはキーをそのまま出す。 */
export function toPrincipalKindLabel(kind: string): string {
  const label = kindLabels[kind]

  if (label === undefined) return kind

  return label
}
