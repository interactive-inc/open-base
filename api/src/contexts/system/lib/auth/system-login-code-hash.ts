/** one-time login codeを固定長SHA-256へ変換し、生codeを永続化させない。 */
export async function systemLoginCodeHash(rawCode: string): Promise<string | Error> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawCode))

    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to hash System login code")
  }
}
