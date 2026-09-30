export function isValidOrganizationUnitText(value: string, maximumLength: number): boolean {
  return value.length >= 1 && value.length <= maximumLength && value.trim() === value
}
