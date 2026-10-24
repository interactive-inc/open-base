/** 確認した公開等級の版と、操作ごとの再送キー。 */
export type GradeResponse = {
  id: string
  code: string
  name: string
  rank: number | null
  description: string | null
  revision: number
  organizationRevision: number
  effectiveFrom: string
  effectiveTo: string | null
  commandId: string
  cancelCommandId: string
}

export type GradeDefinitionCommand = {
  commandId: string
  expectedRevision: number
  reason: string
  resource: {
    organizationId: string
    type: "grade"
    id: string
    revision: number
    state: "active" | "void"
    effectiveFrom: string
    effectiveTo: string | null
    attributes: {
      code: string
      officialName: string
      rank: number | null
      description: string | null
    }
  }
}
