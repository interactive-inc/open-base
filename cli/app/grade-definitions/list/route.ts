import { createCompanyDefinitionListHandlers } from "@/lib/company-definitions/create-company-definition-list-handlers"

export const help = `base grade-definitions list --organization-id <id> [--as-of <YYYY-MM-DD>] [--organization-revision <revision>]

公開履歴から会社版・資源ID・資源版・有効期間を返します。
as-ofを省略すると将来予約を含む資源版、指定するとその日に有効な定義を返します。
organization-revisionを指定するとその会社版の記録に固定し、省略すると現在の会社版を使います。`

export default createCompanyDefinitionListHandlers({ type: "grade", help })
