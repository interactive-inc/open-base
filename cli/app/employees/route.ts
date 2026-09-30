import { factory } from "@/factory"

export const help = `base employees — 社員関連

usage:
  base employees search [--q <kw>] [--dept <name>] [--status <status>]
  base employees show <code>
  base employees register --code <code> --name <name> --hire-on <date> --email <email> --role <role> --password-stdin
  base employees update <code> --name <name> --employee-id <id> --company-revision <n> --person-revision <n> --effective-on <date> --idempotency-key <uuid> --reason <text>
  base employees state --code <code> [--as-of <date>]
  base employees adoption --employee-id <id> | --data <confirmed-history.json> --idempotency-key <uuid>
  base employees timeline --code <code> [--from <date>] [--to <date>]
  base employees archive --code <code>`

export default factory.createHandlers((c) => c.text(help))
