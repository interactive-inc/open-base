"use server"

import { requireAuth } from "@/lib/auth/require-auth"
import { getPersonnelPositionSnapshot } from "@/lib/api/get-personnel-position-snapshot"
import { z } from "zod"

/** 確認済み会社版を保持して、指定した発効日の役職を取得する。 */
export async function loadPersonnelPositionSnapshot(
  organizationRevision: number,
  effectiveOn: string,
) {
  await requireAuth()
  const snapshot = z
    .object({
      organizationRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      effectiveOn: z.string().date(),
    })
    .safeParse({ organizationRevision, effectiveOn })

  if (!snapshot.success) return { ok: false as const, error: "有効日を入力してください" }

  const positions = await getPersonnelPositionSnapshot(snapshot.data)

  if (positions instanceof Error) return { ok: false as const, error: positions.message }

  return { ok: true as const, ...positions, effectiveOn }
}
