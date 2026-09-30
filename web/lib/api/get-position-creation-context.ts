import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"

/** 新規役職の確認版と、その入力を再送するための識別子を一度だけ作る。 */
export async function getPositionCreationContext() {
  const snapshot = await getCompanyDefinitionResources({ type: "position" })
  if (snapshot instanceof Error) return snapshot
  return {
    companyRevision: snapshot.organizationRevision,
    commandId: crypto.randomUUID(),
    positionId: `position:${crypto.randomUUID()}`,
  }
}
