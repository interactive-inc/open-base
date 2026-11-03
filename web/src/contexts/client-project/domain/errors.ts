export class ClientProjectError extends Error {
  constructor(
    readonly status: 403 | 409 | 503,
    message: string,
  ) {
    super(message)
  }
}
