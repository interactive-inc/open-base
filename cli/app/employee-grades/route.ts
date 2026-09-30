import { factory } from "@/factory"

export const help = `base employee-grades — 公開Companyの期間付き等級割当

  base employee-grades list --organization-id <id> --employee-id <id> [--as-of <date>]
  base employee-grades create --data <confirmed-grade-assignment.json> --idempotency-key <key>`

export default factory.createHandlers((c) => c.text(help))
