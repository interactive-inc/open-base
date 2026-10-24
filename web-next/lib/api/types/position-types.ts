/** 確認した公開役職の版と、操作ごとの再送キー。 */
export type PositionResponse = {
  id: string
  code: string
  name: string
  rank: number | null
  jobId: string | null
  description: string | null
  revision: number
  organizationRevision: number
  effectiveFrom: string
  effectiveTo: string | null
  commandId: string
  cancelCommandId: string
}

export type PositionDefinitionCommand = {
  commandId: string
  expectedRevision: number
  reason: string
  resource: {
    organizationId: string
    type: "position"
    id: string
    revision: number
    state: "active" | "void"
    effectiveFrom: string
    effectiveTo: string | null
    attributes: {
      code: string
      officialName: string
      rank: number | null
      jobId: string | null
      description: string | null
    }
  }
}
