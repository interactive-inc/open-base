import { expect, test } from "bun:test"
import { ATTACHMENT_MAX_BYTE_SIZE } from "@system/domain/catalogs/attachments/attachment-content.catalog"
import { limitSystemAttachmentUploadBody } from "@system/interface/middlewares/limit-system-attachment-upload-body"
import { systemFactory } from "@system/interface/request-environment/system-factory"

const app = systemFactory
  .createApp()
  .post("/upload", limitSystemAttachmentUploadBody, async (c) => c.text(await c.req.text()))
for (const withContentLength of [false, true]) {
  test(`サイズ超過後に入力をcancelしてreaderを残さない: length=${withContentLength}`, async () => {
    const canceled: boolean[] = []
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1))
      },
      cancel() {
        canceled.push(true)
      },
    })
    const headers = new Headers()
    if (withContentLength)
      headers.set("content-length", String(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1))
    const response = await app.request("https://api.example.com/upload", {
      method: "POST",
      body,
      headers,
    })
    expect(response.status).toBe(413)
    expect(body.locked).toBe(false)
    expect(canceled).toEqual([true])
  })
}

for (const cleanup of ["reject", "pending"]) {
  for (const withContentLength of [false, true]) {
    test(`cancelが${cleanup}でも413を返してlockを残さない: length=${withContentLength}`, async () => {
      const canceled: boolean[] = []
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1))
        },
        cancel() {
          canceled.push(true)
          if (cleanup === "reject") return Promise.reject(new Error("example-cancel-failure"))
          return new Promise<void>(() => undefined)
        },
      })
      const headers = new Headers()
      if (withContentLength)
        headers.set("content-length", String(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1))
      const response = await app.request("https://api.example.com/upload", {
        method: "POST",
        body,
        headers,
      })
      expect(response.status).toBe(413)
      expect(body.locked).toBe(false)
      expect(canceled).toEqual([true])
    }, 1000)
  }
}

test("小さいContent-Lengthでも実際の本文量を制限する", async () => {
  const canceled: boolean[] = []
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(ATTACHMENT_MAX_BYTE_SIZE + 64 * 1024 + 1))
    },
    cancel() {
      canceled.push(true)
    },
  })
  const response = await app.request("https://api.example.com/upload", {
    method: "POST",
    body,
    headers: { "content-length": "1" },
  })
  expect(response.status).toBe(413)
  expect(body.locked).toBe(false)
  expect(canceled).toEqual([true])
})

test("読取エラーのreaderも解放して400を返す", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("example-read-failure"))
    },
  })
  const response = await app.request("https://api.example.com/upload", { method: "POST", body })
  expect(response.status).toBe(400)
  expect(body.locked).toBe(false)
})

test("正常なbodyを次へ渡し入力readerを解放する", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("example-body"))
      controller.close()
    },
  })
  const response = await app.request("https://api.example.com/upload", { method: "POST", body })
  expect(response.status).toBe(200)
  expect(await response.text()).toBe("example-body")
  expect(body.locked).toBe(false)
})

test("producerがbufferを再利用しても読み取った順序と内容を保つ", async () => {
  const bytes = new Uint8Array(1)
  const state = { count: 0 }
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        bytes[0] = 97 + state.count
        controller.enqueue(bytes)
        state.count += 1
        if (state.count === 2) controller.close()
      },
    },
    { highWaterMark: 0 },
  )
  const response = await app.request("https://api.example.com/upload", { method: "POST", body })
  expect(response.status).toBe(200)
  expect(await response.text()).toBe("ab")
  expect(body.locked).toBe(false)
})
