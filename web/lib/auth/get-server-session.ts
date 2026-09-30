import { cookies } from "next/headers"

/**
 * httpOnly cookie `session` に保存した Bearer トークンを取り出す。
 * Server Component / Server Action 専用。クライアントへは露出しない。
 */
export async function getServerSession(): Promise<string | null> {
  const cookieStore = await cookies()

  const sessionCookie = cookieStore.get("session")

  if (sessionCookie === undefined) {
    return null
  }

  if (sessionCookie.value === "") {
    return null
  }

  return sessionCookie.value
}
