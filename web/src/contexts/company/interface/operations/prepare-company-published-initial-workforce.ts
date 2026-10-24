import { PublishedInitialWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/employee/published-initial-workforce.adapter"

/** 初回の雇用を公開正本の人員として用意する公開境界。 */
export function prepareCompanyPublishedInitialWorkforce(
  c: ConstructorParameters<typeof PublishedInitialWorkforceAdapter>[0],
  ...input: Parameters<PublishedInitialWorkforceAdapter["prepare"]>
): ReturnType<PublishedInitialWorkforceAdapter["prepare"]> {
  return new PublishedInitialWorkforceAdapter(c).prepare(...input)
}
