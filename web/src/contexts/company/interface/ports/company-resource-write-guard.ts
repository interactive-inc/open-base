import type { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

/** 他の所有者の参照整合性を、資源変更と同じ batch の先頭で検証する。 */
export type CompanyResourceWriteGuard = NonNullable<
  ConstructorParameters<typeof D1CompanyResourceRepository>[0]["writeGuard"]
>
