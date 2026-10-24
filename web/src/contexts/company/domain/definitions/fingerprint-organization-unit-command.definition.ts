type OrganizationUnitCommand =
  | Readonly<{
      kind: "create"
      actorAccountId: string
      code: string
      officialName: string
      parentCode: string | null
    }>
  | Readonly<{
      kind: "update"
      expectedOrganizationRevision: number
      expectedAsOf: string
      actorAccountId: string
      code: string
      officialName: string
      parentCode: string | null
    }>
  | Readonly<{
      kind: "delete"
      expectedOrganizationRevision: number
      expectedAsOf: string
      actorAccountId: string
      code: string
    }>

/** 組織単位commandの利用者入力だけから、再送時も不変な指紋を作る。 */
export async function fingerprintOrganizationUnitCommand(
  command: OrganizationUnitCommand,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(command))
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}
