export const companyResourceTypes = [
  "legal-entity",
  "company-profile",
  "site",
  "workplace",
  "person",
  "employee",
  "employment",
  "organization-unit",
  "assignment",
  "reporting-relation",
  "job",
  "position",
  "grade",
  "grade-assignment",
  "organizational-office",
  "office-assignment",
  "responsibility",
  "authority-scope",
  "responsibility-assignment",
  "collective-body",
  "collective-body-membership",
  "organizational-authority",
  "account-employee-link",
  "personnel-action",
] as const

export type CompanyResourceType = (typeof companyResourceTypes)[number]

/** 既存の基本情報を訂正する限定資格で扱えるCompany資源。 */
export const basicWorkforceResourceTypes: ReadonlyArray<CompanyResourceType> = [
  "person",
  "employee",
  "employment",
]
