/** HTTPのstatusを先に受信し、finish後の壊れたgzip本文で読取だけを失敗させる。 */
export function createUnreadableErrorResponse(status: number) {
  const state: {
    controller: ReadableStreamDefaultController<Uint8Array> | null
    finished: boolean
  } = { controller: null, finished: false }
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        state.controller = controller
        controller.enqueue(new Uint8Array([31, 139, 8, 0, 0, 0, 0, 0, 0, 3]))
      },
      cancel() {
        state.finished = true
      },
    }),
    { status, headers: { "content-type": "application/json", "content-encoding": "gzip" } },
  )
  return {
    response,
    finish: () => {
      if (state.finished || state.controller === null) return
      state.finished = true
      state.controller.enqueue(new TextEncoder().encode("example-unreadable-body"))
      state.controller.close()
    },
  }
}
