export const employmentStatuses = ["PRE_HIRE", "ACTIVE", "ON_LEAVE", "TERMINATED"] as const

export type EmploymentStatus = (typeof employmentStatuses)[number]

export const persistedEmploymentStatuses = ["ACTIVE", "ON_LEAVE", "TERMINATED"] as const

export type PersistedEmploymentStatus = (typeof persistedEmploymentStatuses)[number]
