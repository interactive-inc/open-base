/** transportが収集し、System監査の決定的JSONへ変換済みの補助情報。 */
export type SystemSessionAuditContext = Readonly<{
  authorizationJson: string | null
  metadataJson: string | null
}>
