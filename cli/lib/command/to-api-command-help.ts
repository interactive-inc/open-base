import { toApiCommandUsage } from "@/lib/command/to-api-command-usage"
import type { ApiCommandGroup } from "@/lib/command/types"

/** コマンド群のhelpを、定義した経路と入力から組み立てる。 */
export function toApiCommandHelp(group: ApiCommandGroup): string {
  const lines = [`base ${group.name} — ${group.summary}`, "", "usage:"]

  for (const [name, command] of Object.entries(group.commands)) {
    lines.push(`  ${toApiCommandUsage({ group: group.name, name, command })}`)
    lines.push(`      ${command.summary}`)
  }

  if (group.notes !== "") lines.push("", group.notes)

  return lines.join("\n")
}
