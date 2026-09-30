import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"

const resourceOrder = [
  "legal-entity",
  "company-profile",
  "person",
  "employee",
  "employment",
  "organization-unit",
  "job",
  "position",
  "grade",
  "grade-assignment",
  "site",
  "workplace",
  "organizational-office",
  "responsibility",
  "authority-scope",
  "collective-body",
  "assignment",
  "reporting-relation",
  "office-assignment",
  "collective-body-membership",
  "responsibility-assignment",
  "organizational-authority",
  "account-employee-link",
  "personnel-action",
] as const

function persistenceRank(resource: CompanyResourceEntity): number {
  const rank = resourceOrder.indexOf(resource.type)

  return resource.state === "void" ? -rank : rank
}

/** 同一commandの参照元をactive作成時は先、取消時は後に保存する。 */
export function compareCompanyResourcePersistence(
  left: CompanyResourceEntity,
  right: CompanyResourceEntity,
): number {
  const rankDifference = persistenceRank(left) - persistenceRank(right)
  if (rankDifference !== 0) return rankDifference

  const leftKey = `${left.type}\u0000${left.id}`
  const rightKey = `${right.type}\u0000${right.id}`
  if (leftKey < rightKey) return -1
  if (leftKey > rightKey) return 1

  return 0
}
