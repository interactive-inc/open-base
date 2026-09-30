import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import type { PositionResponse } from "@/lib/api/types/position-types"

/** 公開役職のheadと、その読取で確認した会社版を返す。 */
export async function getPositionList() {
  const snapshot = await getCompanyDefinitionResources({ type: "position" })
  if (snapshot instanceof Error) return snapshot
  const positions: PositionResponse[] = []
  for (const resource of snapshot.resources) {
    if (resource.type !== "position") continue
    const attributes = resource.attributes
    if (
      typeof attributes.code !== "string" ||
      typeof attributes.officialName !== "string" ||
      (attributes.rank != null && typeof attributes.rank !== "number") ||
      (attributes.jobId != null && typeof attributes.jobId !== "string") ||
      (attributes.description != null && typeof attributes.description !== "string")
    )
      return new Error("公開役職の属性を読み取れませんでした")
    positions.push({
      id: resource.id,
      revision: resource.revision,
      organizationRevision: snapshot.organizationRevision,
      effectiveFrom: resource.effectiveFrom,
      effectiveTo: resource.effectiveTo,
      code: attributes.code,
      name: attributes.officialName,
      rank: attributes.rank ?? null,
      description: attributes.description ?? null,
      jobId: attributes.jobId ?? null,
      commandId: crypto.randomUUID(),
      cancelCommandId: crypto.randomUUID(),
    })
  }
  return { organizationRevision: snapshot.organizationRevision, positions }
}
