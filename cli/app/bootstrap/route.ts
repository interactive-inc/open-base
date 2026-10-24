import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { resolveBaseUrl } from "@/lib/config/resolve-base-url"
import { SettingsFile } from "@/lib/config/settings-file"
import { createClient } from "@/lib/http/hc-client"
import { readJsonObjectFile } from "@/lib/input/read-json-file"
import { factory } from "@/factory"
import { ApiError, UsageError, InputError } from "@/lib/errors"

export const help = `base bootstrap — Systemの初期アカウントと会社を初期化する

usage:
  base bootstrap --email <email> --company-data <confirmed-company.json> --idempotency-key <uuid> [--token <token>] [--base-url <url>]

初回は初期アカウントを作り、パスキー招待のURLを表示します。URLを開いてパスキーを登録し、
base login でログインしてから、同じコマンドをもう一度実行すると会社を初期化します。

company-dataには name・code・organization_name・representative_name・initial_responsibilities・hire_date・employment_type・locale・time_zone・fiscal_year_start_month・reason を指定します。
雇用区分はFULL_TIMEまたはPART_TIMEです。initial_responsibilitiesは空配列、または確認したMANAGER・PEOPLE_OPERATIONSだけを指定します。
失敗時は同じJSONとキーで再試行してください。--token省略時はBOOTSTRAP_TOKENを使います。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.object({
      help: z.string().optional(),
      email: z.string().optional(),
      "company-data": z.string().optional(),
      "idempotency-key": z.string().uuid().optional(),
      token: z.string().optional(),
      "base-url": z.string().optional(),
    }),
  ),
  async (c) => {
    const input = c.req.valid("json")
    if (input.help) return c.text(help)
    if (!input.email || !input["company-data"] || !input["idempotency-key"])
      throw new UsageError("--email・--company-data・--idempotency-key が必要です")
    const token = input.token ?? process.env.BOOTSTRAP_TOKEN
    if (!token) throw new UsageError("--token または環境変数 BOOTSTRAP_TOKEN が必要です")
    const declaration = z
      .object({
        name: z.string().trim().min(1).max(200),
        code: z.string().trim().min(1).max(64),
        organization_name: z.string().trim().min(1).max(200),
        representative_name: z.string().trim().min(1).max(200),
        initial_responsibilities: z
          .array(z.enum(["MANAGER", "PEOPLE_OPERATIONS"]))
          .max(2)
          .refine((values) => new Set(values).size === values.length),
        hire_date: z.string().date(),
        employment_type: z.enum(["FULL_TIME", "PART_TIME"]),
        locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
        time_zone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
        fiscal_year_start_month: z.number().int().min(1).max(12),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .safeParse(await readJsonObjectFile(input["company-data"]))
    if (!declaration.success) throw new InputError("確認済み会社JSONの形式が不正です")
    const baseUrl = resolveBaseUrl(input["base-url"])
    const client = await createClient(baseUrl)
    let enrollmentUrl: string | null = null
    try {
      const response = await client.system.bootstrap.$post({ json: { token, email: input.email } })
      const created = z
        .object({ passkey_enrollment: z.object({ token: z.string() }) })
        .parse(await response.json())
      const url = new URL("/enroll", baseUrl)
      url.searchParams.set("token", created.passkey_enrollment.token)
      enrollmentUrl = url.toString()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error
    }
    const session = await new SettingsFile().tokensFor(baseUrl)
    if (enrollmentUrl !== null || session.token === null) {
      return c.text(
        [
          enrollmentUrl === null
            ? "Systemは初期化済みです。"
            : `初期アカウントを作りました。次のURLでパスキーを登録してください:\n${enrollmentUrl}`,
          "パスキーを登録したら base login でログインし、同じコマンドをもう一度実行してください。",
        ].join("\n"),
      )
    }
    const companyResponse = await client.company.bootstrap.$post(
      { header: { "idempotency-key": input["idempotency-key"] }, json: declaration.data },
      { headers: { Authorization: `Bearer ${session.token}` } },
    )
    const company = z
      .object({
        account_id: z.string(),
        employee_id: z.string(),
        organization_revision: z.number(),
        replayed: z.boolean(),
      })
      .parse(await companyResponse.json())
    return c.text(
      `${company.replayed ? "保存済みの初期化を確認しました" : "会社を初期化しました"} account_id=${company.account_id} employee_id=${company.employee_id} email=${input.email}`,
    )
  },
)
