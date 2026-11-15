import type { ApiCommand } from "@/lib/command/types"

/** 一つのコマンドの位置引数とフラグを、helpに載せる一行の書式にする。 */
export function toApiCommandUsage(props: { group: string; name: string; command: ApiCommand }) {
  const command = props.command

  const parts = [`base ${props.group} ${props.name}`]

  for (const match of command.path.matchAll(/:([A-Za-z]+)/g)) {
    parts.push(`<${(match[1] ?? "").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}>`)
  }

  if (command.organization === "flag") parts.push("--organization-id <id>")

  for (const flag of Object.keys(command.query ?? {})) {
    const required = command.requiredQuery?.includes(flag) === true
    parts.push(required ? `--${flag} <${flag}>` : `[--${flag} <${flag}>]`)
  }

  if (command.data === "required") parts.push("--data <file.json>")
  if (command.data === "optional") parts.push("[--data <file.json>]")
  if (command.secret !== undefined)
    parts.push(command.secret.required ? `--${command.secret.flag}` : `[--${command.secret.flag}]`)
  if (command.idempotencyKey) parts.push("--idempotency-key <key>")
  if (command.stepUp) parts.push("--step-up <token>")
  if (command.download) parts.push("--output <file>")

  return parts.join(" ")
}
