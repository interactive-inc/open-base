import { CompanyPersonnelEventEntity } from "@/contexts/company/domain/entities/company-personnel-event.entity"
import { CompanyUnavailableError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { z } from "zod"

const cursorSchema = z
  .object({
    version: z.literal(1),
    anchor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    before: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    employeeId: z.string().nullable(),
    id: z.string().nullable(),
    from: z.string().date().nullable(),
    to: z.string().date().nullable(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine((cursor) => cursor.before <= cursor.anchor)

const sourceSchema = z
  .object({
    recorded_by_account_id: z.string().min(1).nullable(),
    requested_by_employee_id: z.string().min(1).nullable(),
    source_type: z.enum(["application", "direct", "system"]),
    source_application_id: z.number().int().positive().nullable(),
  })
  .refine(
    (source) => (source.source_type === "application") === (source.source_application_id !== null),
  )

type Context = { env: { DB: D1Database } }
type Query = {
  employeeId: string | null
  id: string | null
  from: string | null
  to: string | null
  limit: number
  cursor: string | null
}

/** 追記済みの発令を、初回取得時の記録範囲に固定して新しい記録から読む。 */
export class CompanyPersonnelHistoryRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(input: Query) {
    let cursor: z.infer<typeof cursorSchema> | null = null
    if (input.cursor !== null) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(atob(input.cursor.replaceAll("-", "+").replaceAll("_", "/"))),
        )
      } catch (cause) {
        return new CompanyValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor", {
          cause,
        })
      }
      if (
        cursor.employeeId !== input.employeeId ||
        cursor.id !== input.id ||
        cursor.from !== input.from ||
        cursor.to !== input.to ||
        cursor.limit !== input.limit
      ) {
        return new CompanyValidationError(
          "履歴カーソルと検索条件が一致しません",
          "invalid_lifecycle_cursor",
        )
      }
    }
    try {
      const anchor =
        cursor?.anchor ??
        z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(
            await this.c.env.DB.prepare(
              "SELECT COALESCE(MAX(rowid), 0) AS anchor FROM company_personnel_actions",
            ).first<number>("anchor"),
          )
      const rows = await this.c.env.DB.prepare(`
        SELECT action.*, action.rowid AS sequence,
          (SELECT correction.id FROM company_personnel_actions correction
           WHERE correction.corrects_action_id = action.id AND correction.rowid <= ?1) AS corrected_by_action_id
        FROM company_personnel_actions action
        WHERE action.rowid <= ?1 AND (?2 IS NULL OR action.rowid < ?2)
          AND (?3 IS NULL OR action.employee_id = ?3)
          AND (?4 IS NULL OR action.id = ?4)
          AND (?5 IS NULL OR action.event_on >= ?5)
          AND (?6 IS NULL OR action.event_on <= ?6)
        ORDER BY action.rowid DESC LIMIT ?7
      `)
        .bind(
          anchor,
          cursor?.before ?? null,
          input.employeeId,
          input.id,
          input.from,
          input.to,
          input.limit + 1,
        )
        .all()
      if (!rows.success) throw new Error("Personnel history query failed")
      const data = []
      for (const row of rows.results.slice(0, input.limit)) {
        const event = CompanyPersonnelEventEntity.create({
          sequence: row.sequence,
          id: row.id,
          employeeId: row.employee_id,
          kind: row.kind,
          eventOn: row.event_on,
          recordedAt: row.recorded_at,
          fingerprint: row.payload_fingerprint,
          correctsActionId: row.corrects_action_id,
          correctedByActionId: row.corrected_by_action_id,
          summary: JSON.parse(z.string().parse(row.summary_json)),
        })
        if (event instanceof Error) throw event
        const source = sourceSchema.parse(row)
        data.push({ ...event.props, ...source })
      }
      const last = data.at(-1)
      const nextCursor =
        rows.results.length <= input.limit || last === undefined
          ? null
          : btoa(
              JSON.stringify({
                version: 1,
                anchor,
                before: last.sequence,
                employeeId: input.employeeId,
                id: input.id,
                from: input.from,
                to: input.to,
                limit: input.limit,
              }),
            )
              .replaceAll("+", "-")
              .replaceAll("/", "_")
              .replace(/=+$/u, "")
      return { data, nextCursor }
    } catch (cause) {
      return new CompanyUnavailableError(
        "人事発令履歴を取得できません",
        "company_read_unavailable",
        { cause },
      )
    }
  }
}
