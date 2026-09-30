import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import type { GradeResponse } from "@/lib/api/types/grade-types"

/** 公開等級のheadと、その読取で確認した会社版を返す。 */
export async function getGradeList() {
  const snapshot = await getCompanyDefinitionResources({ type: "grade" })
  if (snapshot instanceof Error) return snapshot
  const grades: GradeResponse[] = []
  for (const resource of snapshot.resources) {
    if (resource.type !== "grade") continue
    const attributes = resource.attributes
    if (
      typeof attributes.code !== "string" ||
      typeof attributes.officialName !== "string" ||
      (attributes.rank != null && typeof attributes.rank !== "number") ||
      (attributes.description != null && typeof attributes.description !== "string")
    )
      return new Error("公開等級の属性を読み取れませんでした")
    grades.push({
      id: resource.id,
      revision: resource.revision,
      organizationRevision: snapshot.organizationRevision,
      effectiveFrom: resource.effectiveFrom,
      effectiveTo: resource.effectiveTo,
      code: attributes.code,
      name: attributes.officialName,
      rank: attributes.rank ?? null,
      description: attributes.description ?? null,
      commandId: crypto.randomUUID(),
      cancelCommandId: crypto.randomUUID(),
    })
  }
  return { organizationRevision: snapshot.organizationRevision, grades }
}
