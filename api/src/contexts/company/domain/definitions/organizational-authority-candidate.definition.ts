import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/**
 * Company が理解する判断資格の条件。
 *
 * request の workflow selector は App 固有の入力契約なので Company へ持ち込まない。
 * 呼び出し側は自分の語彙をこの最小条件へ変換する。
 */
export type OrganizationalAuthorityCriterion =
  | Readonly<{ kind: "technical_role"; roleKey: string }>
  | Readonly<{ kind: "employee"; employeeCode: string }>
  | Readonly<{ kind: "direct_manager" }>
  | Readonly<{ kind: "department_manager" }>
  | Readonly<{ kind: "target_department_manager" }>
  | Readonly<{
      kind: "responsibility"
      responsibilityType: string
      organizationUnitCode: string | null
    }>
  | Readonly<{ kind: "management_chain" }>

/** Company が判断資格を評価した時点と、その根拠にした組織投影。 */
export type OrganizationalAuthoritySnapshot = Readonly<{
  schemaVersion: 1
  source: "lifecycle"
  asOf: string
  organizationRevision: number
  companyRevision?: number
}>

/** 一つの条件が一つの候補を導いた根拠。呼び出し側は正本ではなく証拠として保存する。 */
export type OrganizationalAuthorityQualification = Readonly<{
  criterionIndex: number
  evidence: Readonly<Record<string, unknown>>
}>

/**
 * Company の資格を満たし、有効な canonical System Account と一意に対応した Employee。
 * Company 固有の Employee ID は資格証拠、Account ID は判断主体の正本を表す。
 */
export type OrganizationalAuthorityCandidate = Readonly<{
  employeeId: EmployeeId
  accountId: AccountId
  qualification: OrganizationalAuthorityQualification
}>

/** 同じ時点・同じ組織投影で解決された候補集合。 */
export type OrganizationalAuthorityCandidateResolution = Readonly<{
  snapshot: OrganizationalAuthoritySnapshot
  candidates: ReadonlyArray<OrganizationalAuthorityCandidate>
}>
