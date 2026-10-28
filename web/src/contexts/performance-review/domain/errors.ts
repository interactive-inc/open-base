export class ReviewError extends Error {
  constructor(
    readonly status: 403 | 404 | 409 | 422 | 503,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = "ReviewError"
  }
}
