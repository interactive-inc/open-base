import { getCompanyDefinitionResources } from "@/lib/api/get-company-definition-resources"

/** 新規等級の確認版と、その入力を再送するための識別子を一度だけ作る。 */
export async function getGradeCreationContext() {
  const snapshot = await getCompanyDefinitionResources({ type: "grade" })
  if (snapshot instanceof Error) return snapshot
  return {
    companyRevision: snapshot.organizationRevision,
    commandId: crypto.randomUUID(),
    gradeId: `grade:${crypto.randomUUID()}`,
  }
}
