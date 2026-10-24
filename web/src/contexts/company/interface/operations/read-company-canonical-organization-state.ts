import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"

/** 会社営業日の正規の組織の状態を読む公開境界。 */
export function readCompanyCanonicalOrganizationState(
  c: ConstructorParameters<typeof ReadCanonicalOrganizationStateAdapter>[0],
  ...input: Parameters<ReadCanonicalOrganizationStateAdapter["readCanonicalOrganizationState"]>
): ReturnType<ReadCanonicalOrganizationStateAdapter["readCanonicalOrganizationState"]> {
  return new ReadCanonicalOrganizationStateAdapter(c).readCanonicalOrganizationState(...input)
}
