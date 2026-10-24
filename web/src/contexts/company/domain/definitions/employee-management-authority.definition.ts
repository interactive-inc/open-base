export type EmployeeManagementAuthority = Readonly<{
  directManager: boolean
  departmentManager: boolean
  managementChain: boolean
}>

export const noEmployeeManagementAuthority: EmployeeManagementAuthority = {
  directManager: false,
  departmentManager: false,
  managementChain: false,
}
