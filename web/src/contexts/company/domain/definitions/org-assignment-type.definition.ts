export const orgAssignmentTypes = ["PRIMARY", "CONCURRENT"] as const

export type OrgAssignmentType = (typeof orgAssignmentTypes)[number]
