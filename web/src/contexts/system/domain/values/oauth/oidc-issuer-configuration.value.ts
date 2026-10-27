import { InvalidOidcIssuerError } from "@system/domain/errors"

export type OidcIssuerConfiguration = Readonly<{
  issuersByHostname: Readonly<Record<string, string>>
  localProxyHostnames: ReadonlyArray<string>
  localIssuerHostname: string | null
}>

export class OidcIssuerConfigurationValue {
  readonly issuersByHostname: Readonly<Record<string, string>>
  readonly localProxyHostnames: ReadonlyArray<string>
  readonly localIssuerHostname: string | null

  private static isCanonicalHostname(value: unknown): value is string {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= 253 &&
      value === value.toLowerCase()
    )
  }

  private static isOidcIssuerConfiguration(value: unknown): value is OidcIssuerConfiguration {
    if (!OidcIssuerConfigurationValue.isPlainRecord(value)) return false
    const issuersByHostname = value.issuersByHostname
    const localProxyHostnames = value.localProxyHostnames
    const localIssuerHostname = value.localIssuerHostname

    return (
      OidcIssuerConfigurationValue.isPlainRecord(issuersByHostname) &&
      Array.isArray(localProxyHostnames) &&
      localProxyHostnames.length <= 20 &&
      localProxyHostnames.every((hostname) =>
        OidcIssuerConfigurationValue.isCanonicalHostname(hostname),
      ) &&
      (localIssuerHostname === null ||
        OidcIssuerConfigurationValue.isCanonicalHostname(localIssuerHostname))
    )
  }

  private static isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  private static parseForwardedAuthority(value: string): URL | null {
    if (value.trim() !== value || value.length === 0 || value.length > 253) return null

    let parsed: URL
    try {
      parsed = new URL(`https://${value}`)
    } catch {
      return null
    }

    return parsed.username === "" &&
      parsed.password === "" &&
      parsed.port === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === ""
      ? parsed
      : null
  }

  constructor(configuration: OidcIssuerConfiguration) {
    if (!OidcIssuerConfigurationValue.isOidcIssuerConfiguration(configuration)) {
      throw new InvalidOidcIssuerError()
    }
    this.issuersByHostname = Object.freeze({ ...configuration.issuersByHostname })
    this.localProxyHostnames = Object.freeze([...configuration.localProxyHostnames])
    this.localIssuerHostname = configuration.localIssuerHostname
    Object.freeze(this)
  }

  static create(value: unknown): OidcIssuerConfigurationValue | InvalidOidcIssuerError {
    if (!OidcIssuerConfigurationValue.isOidcIssuerConfiguration(value)) {
      return new InvalidOidcIssuerError()
    }
    return new OidcIssuerConfigurationValue(value)
  }

  resolve(props: Readonly<{ requestUrl: string; forwardedHost: string | null }>): string | Error {
    if (
      typeof props.requestUrl !== "string" ||
      (props.forwardedHost !== null && typeof props.forwardedHost !== "string")
    ) {
      return new InvalidOidcIssuerError()
    }

    let requestUrl: URL
    try {
      requestUrl = new URL(props.requestUrl)
    } catch {
      return new InvalidOidcIssuerError()
    }
    if (requestUrl.username !== "" || requestUrl.password !== "") {
      return new InvalidOidcIssuerError()
    }

    const requestHostname = requestUrl.hostname.toLowerCase()
    if (requestUrl.protocol === "https:" && requestUrl.port === "") {
      const directIssuer = this.configuredIssuer(requestHostname)
      if (directIssuer !== null) return directIssuer
    }

    if (
      requestUrl.protocol !== "http:" ||
      !this.localProxyHostnames.includes(requestHostname) ||
      this.localIssuerHostname === null ||
      props.forwardedHost === null ||
      props.forwardedHost.includes(",")
    ) {
      return new InvalidOidcIssuerError()
    }

    const forwardedUrl = OidcIssuerConfigurationValue.parseForwardedAuthority(props.forwardedHost)
    if (forwardedUrl === null || forwardedUrl.hostname.toLowerCase() !== this.localIssuerHostname) {
      return new InvalidOidcIssuerError()
    }

    return this.configuredIssuer(this.localIssuerHostname) ?? new InvalidOidcIssuerError()
  }

  private configuredIssuer(hostname: string): string | null {
    const descriptor = Object.getOwnPropertyDescriptor(this.issuersByHostname, hostname)
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      return null
    }

    const issuer = descriptor.value
    if (issuer.length === 0 || issuer.length > 2_048) return null

    let parsedIssuer: URL
    try {
      parsedIssuer = new URL(issuer)
    } catch {
      return null
    }

    return parsedIssuer.protocol === "https:" &&
      parsedIssuer.hostname.toLowerCase() === hostname &&
      parsedIssuer.port === "" &&
      parsedIssuer.username === "" &&
      parsedIssuer.password === "" &&
      parsedIssuer.search === "" &&
      parsedIssuer.hash === ""
      ? issuer
      : null
  }
}
