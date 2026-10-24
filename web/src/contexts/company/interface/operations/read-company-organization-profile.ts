import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationProfileVersion } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import { D1OrganizationProfileAdapter } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { lifecycleSha256 } from "@/contexts/company/domain/definitions/lifecycle-sha256.definition"
import { z } from "zod"

const profileAttributes = z
  .object({
    displayName: z.string(),
    representativeName: z.string().optional(),
    locale: z.string(),
    timeZone: z.string(),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
  })
  .strict()

export type CompanyOrganizationProfile = Readonly<{
  name: string
  representativeName: string | null
  locale: string | null
  timeZone: string | null
  fiscalYearStartMonth: number | null
  version: OrganizationProfileVersion
}>

/** 確定した法人プロフィールを有効日で読み、内部の旧投影・原文を公開しない。 */
export async function readCompanyOrganizationProfile(
  input: Readonly<{
    database: D1Database
    organizationId: string
    effectiveOn: CalendarDate
    organizationRevision?: number
  }>,
): Promise<CompanyOrganizationProfile | null | Error> {
  if (input.organizationRevision !== undefined) {
    const snapshot = await new D1CompanyResourceRepository({ database: input.database }).findMany({
      organizationId: input.organizationId,
      types: ["company-profile"],
      effectiveOn: input.effectiveOn,
      organizationRevision: input.organizationRevision,
    })
    if (!snapshot.ok)
      return new Error("company profile snapshot is unavailable", { cause: snapshot.cause })
    if (snapshot.resources.length === 0) return null
    if (snapshot.resources.length !== 1) return new Error("company profile identity is ambiguous")
    const resource = snapshot.resources[0]
    if (resource === undefined) return null
    const parsed = profileAttributes.safeParse(resource.attributes)
    if (!parsed.success) return new Error("company profile is invalid", { cause: parsed.error })
    const source = JSON.stringify({
      organizationRevision: snapshot.organizationRevision,
      resource: resource.toProps(),
    })
    return {
      name: parsed.data.displayName,
      representativeName: parsed.data.representativeName ?? null,
      locale: parsed.data.locale,
      timeZone: parsed.data.timeZone,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
      version: {
        organizationId: input.organizationId,
        organizationRevision: snapshot.organizationRevision,
        resourceId: resource.id,
        resourceRevision: resource.revision,
        effectiveOn: input.effectiveOn,
        effectiveTo: resource.effectiveTo,
        sourceFingerprint: await lifecycleSha256(source),
      },
    }
  }
  const profile = await new D1OrganizationProfileAdapter(input.database).find(
    input.organizationId,
    input.effectiveOn,
  )
  if (profile === null || profile instanceof Error) return profile
  return {
    name: profile.name,
    representativeName: profile.representativeName,
    locale: profile.props.locale,
    timeZone: profile.props.timeZone,
    fiscalYearStartMonth: profile.props.fiscalYearStartMonth,
    version: profile.props.version,
  }
}
