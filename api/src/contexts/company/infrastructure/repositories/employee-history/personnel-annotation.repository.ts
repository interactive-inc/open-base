import { PersonnelAnnotationEntity } from "@/contexts/company/domain/entities/personnel-annotation.entity"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { personnelAnnotations } from "@/contexts/company/infrastructure/schema/personnel-annotation"
import { and, count, desc, eq, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

type Context = CompanyContext

export class PersonnelAnnotationRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(input: {
    employeeId: string
    kind: string | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<PersonnelAnnotationEntity> | Error> {
    try {
      const rows = await this.c.var.database
        .select({
          id: personnelAnnotations.id,
          employeeId: personnelAnnotations.employeeId,
          kind: personnelAnnotations.kind,
          effectiveDate: personnelAnnotations.effectiveDate,
          fromDepartmentCode: personnelAnnotations.fromDepartmentCode,
          toDepartmentCode: personnelAnnotations.toDepartmentCode,
          note: personnelAnnotations.note,
          createdAt: personnelAnnotations.createdAt,
        })
        .from(personnelAnnotations)
        .where(this.conditions(input.employeeId, input.kind))
        .orderBy(
          desc(personnelAnnotations.effectiveDate),
          desc(personnelAnnotations.createdAt),
          desc(sql`${personnelAnnotations}.rowid`),
        )
        .limit(input.limit)
        .offset(input.offset)
      return rows.map((row) => PersonnelAnnotationEntity.restore(row))
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to list Company employee events")
    }
  }

  async countByEmployeeId(input: {
    employeeId: string
    kind: string | null
  }): Promise<number | Error> {
    try {
      return (
        (
          await this.c.var.database
            .select({ total: count() })
            .from(personnelAnnotations)
            .where(this.conditions(input.employeeId, input.kind))
        )[0]?.total ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to count Company employee events")
    }
  }

  private conditions(employeeId: string, kind: string | null): SQL | undefined {
    return and(
      eq(personnelAnnotations.employeeId, employeeId),
      ...(kind === null ? [] : [eq(personnelAnnotations.kind, kind)]),
    )
  }
}
