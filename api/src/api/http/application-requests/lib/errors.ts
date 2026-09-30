export class InvalidApplicationPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidApplicationPayloadError"
  }
}
