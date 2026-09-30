import { InvalidMcpRedirectUriConfigurationError } from "@system/domain/errors"

export type McpRedirectUriConfigurationProps = Readonly<{
  productionRedirectUris: ReadonlyArray<string>
  localHostnames: ReadonlyArray<string>
  callbackPath: string
}>

/** MCP callback allowlistと完全一致判定を所有するValue Object。 */
export class McpRedirectUriConfigurationValue {
  readonly productionRedirectUris: ReadonlyArray<string>
  readonly localHostnames: ReadonlyArray<string>
  readonly callbackPath: string

  private constructor(props: McpRedirectUriConfigurationProps) {
    this.productionRedirectUris = Object.freeze([...props.productionRedirectUris])
    this.localHostnames = Object.freeze([...props.localHostnames])
    this.callbackPath = props.callbackPath
    Object.freeze(this)
  }

  static restore(
    props: McpRedirectUriConfigurationProps,
  ): McpRedirectUriConfigurationValue | InvalidMcpRedirectUriConfigurationError {
    if (
      props.productionRedirectUris.length === 0 ||
      new Set(props.productionRedirectUris).size !== props.productionRedirectUris.length ||
      props.localHostnames.length === 0 ||
      new Set(props.localHostnames).size !== props.localHostnames.length ||
      props.localHostnames.some(
        (hostname) =>
          hostname.length === 0 ||
          hostname.trim() !== hostname ||
          hostname.includes("://") ||
          hostname.includes("/"),
      ) ||
      !/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/u.test(props.callbackPath) ||
      props.productionRedirectUris.some((value) => {
        try {
          const url = new URL(value)
          return (
            url.protocol !== "https:" ||
            url.username !== "" ||
            url.password !== "" ||
            url.search !== "" ||
            url.hash !== ""
          )
        } catch {
          return true
        }
      })
    ) {
      return new InvalidMcpRedirectUriConfigurationError()
    }

    return new McpRedirectUriConfigurationValue(props)
  }

  isAllowed(value: string): boolean {
    if (this.productionRedirectUris.includes(value)) return true
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return false
    }
    return (
      parsed.protocol === "http:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      this.localHostnames.includes(parsed.hostname) &&
      parsed.pathname === this.callbackPath &&
      parsed.search === "" &&
      parsed.hash === ""
    )
  }
}
