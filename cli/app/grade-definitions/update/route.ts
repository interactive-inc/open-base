import { createCompanyDefinitionCommandHandlers } from "@/lib/company-definitions/create-company-definition-command-handlers"

export const help = `base grade-definitions update --data <confirmed-definition.json> --idempotency-key <key>

JSONにはorganizationId、expectedRevision、reason、resourcesを指定します。
resourcesは公開APIで確認したID・版・有効期間・属性を持つgradeです。
createはrevision: 1、update/deleteは確認した資源版の次のrevisionを指定します。
deleteはstate: voidで履歴を残して取り消します。同じ内容の再送には同じキーを使ってください。`

export default createCompanyDefinitionCommandHandlers({ type: "grade", action: "update", help })
