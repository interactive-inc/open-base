export const employmentTypes = ["FULL_TIME", "PART_TIME"] as const

export type EmploymentType = (typeof employmentTypes)[number]
