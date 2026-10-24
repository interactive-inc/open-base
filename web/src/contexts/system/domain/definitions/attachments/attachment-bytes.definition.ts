/**
 * 添付本体のバイト列。WebCrypto と object storage が受け取れるよう、
 * backing buffer を ArrayBuffer に固定する（SharedArrayBuffer は受け付けない）。
 */
export type AttachmentBytes = Uint8Array<ArrayBuffer>
