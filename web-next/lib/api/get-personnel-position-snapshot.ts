import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"
import type { PersonnelPositionOption } from "@/lib/api/types/personnel-position-option"

/** 役職の選択肢と、その読取で確認した会社版を一緒に返す。 */
export async function getPersonnelPositionSnapshot(snapshot?: {
  organizationRevision: number
  effectiveOn: string
}) {
  const definitions = await getCompanyDefinitionResources(snapshot)

  if (definitions instanceof Error) return definitions

  if (
    snapshot !== undefined &&
    definitions.organizationRevision !== snapshot.organizationRevision
  ) {
    return new Error("役職情報が会社情報と一致しません。再読み込みしてください。")
  }

  const positions: PersonnelPositionOption[] = []

  for (const resource of definitions.resources) {
    if (resource.type !== "position" || resource.state !== "active") continue
    const code = resource.attributes.code
    const name = resource.attributes.officialName
    if (typeof code !== "string" || typeof name !== "string") {
      return new Error("役職情報を読み込めませんでした。")
    }
    positions.push({ id: resource.id, code, name })
  }

  return { companyRevision: definitions.organizationRevision, positions }
}
