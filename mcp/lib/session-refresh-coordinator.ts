type Props = Readonly<{
  refresh: (baseUrl: string, failedToken: string | null) => Promise<string | null>
}>

/** 同じ接続先の更新と保存を共有し、並行401がrefresh tokenを二重に使わないようにする。 */
export class SessionRefreshCoordinator {
  readonly #inflight = new Map<string, Promise<string | null>>()

  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  refresh(
    input: Readonly<{ baseUrl: string; failedToken: string | null }>,
  ): Promise<string | null> {
    const existing = this.#inflight.get(input.baseUrl)

    if (existing !== undefined) return existing

    const started = this.props.refresh(input.baseUrl, input.failedToken).finally(() => {
      this.#inflight.delete(input.baseUrl)
    })
    this.#inflight.set(input.baseUrl, started)

    return started
  }
}
