import { ReadActiveHeadcountAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-active-headcount.adapter"

/** 在籍中の人数を読む公開境界。 */
export function readCompanyActiveHeadcount(
  c: ConstructorParameters<typeof ReadActiveHeadcountAdapter>[0],
  ...input: Parameters<ReadActiveHeadcountAdapter["readActiveHeadcount"]>
): ReturnType<ReadActiveHeadcountAdapter["readActiveHeadcount"]> {
  return new ReadActiveHeadcountAdapter(c).readActiveHeadcount(...input)
}
