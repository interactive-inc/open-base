import { InvalidOidcClientRegistryError } from "@system/domain/errors"

export type OidcClient = Readonly<{
  id: string
  name: string
  redirectUris: ReadonlyArray<string>
}>

export type OidcClientRegistryProps = Readonly<Record<string, ReadonlyArray<OidcClient>>>

type ResolveProps = Readonly<{ issuer: string; clientId: string; redirectUri: string }>

const maximumIssuers = 1_000
const maximumClientsPerIssuer = 1_000
const maximumRedirectUrisPerClient = 100

/** 許可済みOIDC client snapshotと完全一致解決を所有するValue Object。 */
export class OidcClientRegistryValue {
  readonly #clientsByIssuer: Readonly<Record<string, ReadonlyArray<OidcClient>>>

  private constructor(clientsByIssuer: Readonly<Record<string, ReadonlyArray<OidcClient>>>) {
    this.#clientsByIssuer = clientsByIssuer
    Object.freeze(this)
  }

  static restore(input: unknown): OidcClientRegistryValue | InvalidOidcClientRegistryError {
    if (!OidcClientRegistryValue.isPlainRecord(input)) {
      return new InvalidOidcClientRegistryError()
    }

    const descriptors = Object.getOwnPropertyDescriptors(input)
    if (Object.keys(descriptors).length > maximumIssuers) {
      return new InvalidOidcClientRegistryError()
    }
    const registry: Record<string, ReadonlyArray<OidcClient>> = Object.create(null)
    for (const [issuer, descriptor] of Object.entries(descriptors)) {
      if (
        issuer.length < 1 ||
        issuer.length > 2_048 ||
        !("value" in descriptor) ||
        !Array.isArray(descriptor.value) ||
        descriptor.value.length > maximumClientsPerIssuer
      ) {
        return new InvalidOidcClientRegistryError()
      }

      const clients: OidcClient[] = []
      const clientIds = new Set<string>()
      for (const value of descriptor.value) {
        const client = OidcClientRegistryValue.parseClient(value)
        if (client === null || clientIds.has(client.id)) {
          return new InvalidOidcClientRegistryError()
        }
        clientIds.add(client.id)
        clients.push(client)
      }
      registry[issuer] = Object.freeze(clients)
    }

    return new OidcClientRegistryValue(Object.freeze(registry))
  }

  resolve(props: ResolveProps): OidcClient | null {
    if (
      !OidcClientRegistryValue.isPlainRecord(props) ||
      typeof props.issuer !== "string" ||
      props.issuer.length < 1 ||
      props.issuer.length > 2_048 ||
      typeof props.clientId !== "string" ||
      props.clientId.length < 1 ||
      props.clientId.length > 255 ||
      typeof props.redirectUri !== "string" ||
      props.redirectUri.length < 1 ||
      props.redirectUri.length > 2_048
    ) {
      return null
    }

    const client = this.#clientsByIssuer[props.issuer]?.find(
      (candidate) => candidate.id === props.clientId,
    )
    return client?.redirectUris.includes(props.redirectUri) === true ? client : null
  }

  private static parseClient(value: unknown): OidcClient | null {
    if (!OidcClientRegistryValue.isPlainRecord(value)) return null
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const id = OidcClientRegistryValue.readString(descriptors, "id")
    const name = OidcClientRegistryValue.readString(descriptors, "name")
    const redirectUris = OidcClientRegistryValue.readDataValue(descriptors, "redirectUris")
    if (
      id === null ||
      id.length < 1 ||
      id.length > 255 ||
      name === null ||
      name.trim().length < 1 ||
      name.length > 200 ||
      !Array.isArray(redirectUris) ||
      redirectUris.length < 1 ||
      redirectUris.length > maximumRedirectUrisPerClient
    ) {
      return null
    }

    const parsedRedirectUris: string[] = []
    for (const redirectUri of redirectUris) {
      if (
        typeof redirectUri !== "string" ||
        !OidcClientRegistryValue.isAllowedRedirectUri(redirectUri) ||
        parsedRedirectUris.includes(redirectUri)
      ) {
        return null
      }
      parsedRedirectUris.push(redirectUri)
    }
    return Object.freeze({ id, name, redirectUris: Object.freeze(parsedRedirectUris) })
  }

  private static isAllowedRedirectUri(value: string): boolean {
    if (value.length < 1 || value.length > 2_048) return false
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return false
    }
    if (parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") return false
    if (parsed.protocol === "https:") return true
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "::1" ||
        parsed.hostname === "localhost")
    )
  }

  private static readString(descriptors: PropertyDescriptorMap, key: string): string | null {
    const value = OidcClientRegistryValue.readDataValue(descriptors, key)
    return typeof value === "string" ? value : null
  }

  private static readDataValue(descriptors: PropertyDescriptorMap, key: string): unknown {
    const descriptor = descriptors[key]
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined
  }

  private static isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }
}
