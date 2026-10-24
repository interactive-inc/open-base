export type OrganizationRelation = Readonly<{
  employeeId: string
  managerEmployeeId: string
  organizationUnitId: string
  startsOn: string
  endsOn: string | null
}>
