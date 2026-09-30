import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { createClient } from "@/lib/http/hc-client"
import { ensureOk } from "@/lib/http/ensure-ok"
import { isEntityIdSegment } from "@/lib/is-entity-id-segment"

export const help = `base application-requests workflow-repair reassign <app_id> --candidates <id,id,...> --reason <text> [--required-approvals <n>]`

const MAX_CANDIDATES = 20

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      app_id: z.string().optional(),
      candidates: z.string().optional(),
      reason: z.string().optional(),
      "required-approvals": z.string().optional(),
    }),
  ),
  zValidator("param", z.object({ app_id: z.string().optional() })),
  async (c) => {
    const input = c.req.valid("json")

    if (input.help) {
      return c.text(help)
    }

    const applicationId = c.req.valid("param").app_id ?? input.app_id

    if (!applicationId || !input.candidates || !input.reason) {
      throw new UsageError("app_id と --candidates と --reason が必要です")
    }

    if (isEntityIdSegment(applicationId) === false) {
      throw new UsageError("app_id を指定してください")
    }

    const candidateEmployeeIds = parseCandidateEmployeeIds(input.candidates)

    if (candidateEmployeeIds === null) {
      throw new UsageError(
        `--candidates は従業員 ID をカンマ区切りで 1〜${MAX_CANDIDATES} 件指定してください`,
      )
    }

    const reason = input.reason.trim()

    if (reason === "" || reason.length > 1_000) {
      throw new UsageError("--reason は 1〜1000 文字で指定してください")
    }

    const requiredApprovalsInput = input["required-approvals"]
    const requiredApprovals =
      requiredApprovalsInput === undefined ? undefined : Number(requiredApprovalsInput)

    if (
      requiredApprovals !== undefined &&
      (/^[1-9]\d*$/.test(requiredApprovalsInput ?? "") === false ||
        Number.isSafeInteger(requiredApprovals) === false ||
        requiredApprovals > MAX_CANDIDATES)
    ) {
      throw new UsageError("--required-approvals は 1〜20 の整数で指定してください")
    }

    const client = await createClient()
    const response = await client["company"]["application-requests"][":id"][
      "reassign-workflow-step"
    ].$post({
      param: { id: applicationId },
      json: {
        candidate_employee_ids: candidateEmployeeIds,
        required_approvals: requiredApprovals,
        reason,
      },
    })
    await ensureOk(response)

    return c.json(await response.json())
  },
)

function parseCandidateEmployeeIds(raw: string): string[] | null {
  const values = raw.trim().split(/[\s,]+/)

  if (values.length === 0 || values[0] === "") {
    return null
  }

  const candidates: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (value.length > 255 || /^[A-Za-z0-9:_-]+$/.test(value) === false) return null
    const candidate = value

    if (seen.has(candidate) === false) {
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  return candidates.length > 0 && candidates.length <= MAX_CANDIDATES ? candidates : null
}
