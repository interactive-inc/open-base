import { companyHistoryCommands } from "@/app/company/_modules/company-history-commands"
import { companyRecordCommands } from "@/app/company/_modules/company-record-commands"
import { companySettingCommands } from "@/app/company/_modules/company-setting-commands"
import { createApiCommandHandlers } from "@/lib/command/create-api-command-handlers"
import { toApiCommandHelp } from "@/lib/command/to-api-command-help"
import type { ApiCommandGroup } from "@/lib/command/types"

const group: ApiCommandGroup = {
  name: "company",
  summary: "Companyの正本・履歴・会社の設定",
  defaultCommand: null,
  notes: `save のJSONには organizationId と expectedRevision（表示した会社版）と本文（reason、resources など）を指定します。
CLIは organizationId と expectedRevision を会社と版のヘッダーへ移して送ります。期間や版は推測せず、表示した値を使ってください。
同じ依頼の再送は同じ --idempotency-key を使い、競合時は履歴を確認し直してください。`,
  commands: { ...companyRecordCommands, ...companyHistoryCommands, ...companySettingCommands },
}

export const help = toApiCommandHelp(group)

export default createApiCommandHandlers(group)
