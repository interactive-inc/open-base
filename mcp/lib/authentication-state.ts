type Session = Readonly<{ baseUrl: string; token: string | null }>
type Props = Readonly<{
  resolveBaseUrl: () => string
  readTokens: (baseUrl: string) => Promise<{ token: string | null }>
}>

/** 設定の読み込みが終わるまで初期化を共有し、未完成の認証情報を公開しない。 */
export class AuthenticationState {
  readonly #state: { session: Session | null; loading: Promise<Session> | null } = {
    session: null,
    loading: null,
  }

  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async get(): Promise<Session> {
    if (this.#state.session !== null) return this.#state.session

    if (this.#state.loading === null) {
      this.#state.loading = this.load().finally(() => {
        this.#state.loading = null
      })
    }

    return this.#state.loading
  }

  updateToken(token: string): void {
    if (this.#state.session === null) throw new Error("authentication is not initialized")

    this.#state.session = { ...this.#state.session, token }
  }

  private async load(): Promise<Session> {
    const baseUrl = this.props.resolveBaseUrl()
    const tokens = await this.props.readTokens(baseUrl)

    this.#state.session = { baseUrl, token: tokens.token }

    return this.#state.session
  }
}
