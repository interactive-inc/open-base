import { isCompanyLocaleAndTimeZone } from "@/contexts/company/domain/definitions/is-company-locale-and-time-zone.definition"
import { z } from "zod"
import { OrganizationProfileValue } from "@/contexts/company/domain/values/organization-profile.value"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { organizationProfileSnapshotSql } from "@/contexts/company/infrastructure/adapters/organization/lib/organization-profile-snapshot-sql"

const sourceSchema = z.object({
  organizationId: z.string(),
  organizationRevision: z.number().int().nonnegative(),
  legacyName: z.string(),
  legacyRepresentativeName: z.string(),
  legacyUpdatedAt: z.number(),
  profileCount: z.number().int().nonnegative(),
  resourceId: z.string().nullable(),
  resourceRevision: z.number().int().positive().nullable(),
  state: z.enum(["active", "void"]).nullable(),
  effectiveTo: z.string().date().nullable(),
  attributesJson: z.string().nullable(),
})
const attributesSchema = z
  .object({
    displayName: z.string().trim().min(1).max(2000),
    representativeName: z.string().trim().min(1).max(2000).optional(),
    locale: z.string(),
    timeZone: z.string(),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
  })
  .strict()
  .refine((profile) => isCompanyLocaleAndTimeZone(profile.locale, profile.timeZone))
type Context = D1Database

/** 接続後は公開履歴だけから会社情報を読み、接続前の情報を過去へ補わない。 */
export class D1OrganizationProfileAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async find(
    organizationId: string,
    effectiveOn: string,
  ): Promise<OrganizationProfileValue | null | Error> {
    if (!z.string().date().safeParse(effectiveOn).success)
      return new Error("invalid company business date")
    try {
      const sourceJson = await this.c
        .prepare(organizationProfileSnapshotSql())
        .bind(organizationId, effectiveOn)
        .first<string>("source_json")
      if (sourceJson === null) return null
      const source = sourceSchema.parse(JSON.parse(sourceJson))
      if (source.profileCount > 1) return new Error("company profile identity is ambiguous")
      const version = {
        organizationId,
        organizationRevision: source.organizationRevision,
        resourceId: source.resourceId,
        resourceRevision: source.resourceRevision ?? 0,
        effectiveOn,
        effectiveTo: source.effectiveTo,
        sourceFingerprint: await lifecycleSha256(sourceJson),
      }
      if (source.profileCount === 0) {
        if (source.legacyName === "") return null
        return OrganizationProfileValue.create({
          name: source.legacyName,
          representativeName: source.legacyRepresentativeName || null,
          locale: null,
          timeZone: null,
          fiscalYearStartMonth: null,
          version,
          sourceJson,
        })
      }
      if (
        source.state !== "active" ||
        source.attributesJson === null ||
        (source.effectiveTo !== null && source.effectiveTo <= effectiveOn)
      )
        return null
      const attributes = attributesSchema.parse(JSON.parse(source.attributesJson))
      return OrganizationProfileValue.create({
        name: attributes.displayName,
        representativeName: attributes.representativeName ?? null,
        locale: attributes.locale,
        timeZone: attributes.timeZone,
        fiscalYearStartMonth: attributes.fiscalYearStartMonth,
        version,
        sourceJson,
      })
    } catch (cause) {
      return new Error("company profile snapshot is unavailable", { cause })
    }
  }
  prepareGuard(profile: OrganizationProfileValue): D1PreparedStatement {
    return this.c
      .prepare(
        `SELECT CASE WHEN (${organizationProfileSnapshotSql()}) = ?3 THEN 1 ELSE json_extract('', '$') END`,
      )
      .bind(
        profile.props.version.organizationId,
        profile.props.version.effectiveOn,
        profile.props.sourceJson,
      )
  }
}
