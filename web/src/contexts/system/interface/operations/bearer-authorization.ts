export type BearerAuthorization =
  | Readonly<{ kind: "absent" }>
  | Readonly<{ kind: "malformed" }>
  | Readonly<{ kind: "token"; token: string }>

const absentBearerAuthorization: BearerAuthorization = Object.freeze({ kind: "absent" })
const malformedBearerAuthorization: BearerAuthorization = Object.freeze({ kind: "malformed" })

/** Bearer schemeの有無と構文を区別し、壊れたcredentialのfallbackを防ぐ。 */
export function readBearerAuthorization(header: string | undefined): BearerAuthorization {
  if (header === undefined || !/^Bearer(?:\s|$)/iu.test(header)) {
    return absentBearerAuthorization
  }

  const matched = header.match(/^Bearer[ \t]+(\S+)$/iu)
  const token = matched?.[1]
  if (token === undefined) return malformedBearerAuthorization

  return Object.freeze({ kind: "token", token })
}
