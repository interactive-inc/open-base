"use client"

import { useActionState } from "react"
import { toast } from "sonner"

/**
 * `useActionState` wrapper that fires `toast.success` / `toast.error` automatically.
 *
 * Drop-in replacement for `useActionState` — returns the same `[state, dispatch, isPending]` tuple.
 *
 * @param action        Server Action (same signature as `useActionState` expects).
 * @param initialState  Initial state value.
 * @param successMessage  Toast text on `ok === true`.
 *   - `string`  — static message.
 *   - `(state, formData) => string` — derive from result / submitted data.
 * @param options.onSuccess  Optional callback after a successful action (e.g. close dialog, navigate).
 */
export function useFormAction<S extends { ok: boolean }>(
  action: (state: Awaited<S>, formData: FormData) => S | Promise<S>,
  initialState: Awaited<S>,
  successMessage: string | ((state: Awaited<S>, formData: FormData) => string),
  options?: { onSuccess?: () => void },
): [state: Awaited<S>, dispatch: (payload: FormData) => void, isPending: boolean] {
  return useActionState(async (previousState: Awaited<S>, formData: FormData): Promise<S> => {
    const next = await action(previousState, formData)

    if (next.ok) {
      const message =
        typeof successMessage === "function"
          ? successMessage(next as Awaited<S>, formData)
          : successMessage

      toast.success(message)
      options?.onSuccess?.()
    } else {
      // Support both `{ error }` and `{ message }` state shapes.
      const record = next as Record<string, unknown>

      const errorText =
        (typeof record.error === "string" ? record.error : null) ??
        (typeof record.message === "string" ? record.message : null)

      if (errorText !== null) {
        toast.error(errorText)
      }
    }

    return next
  }, initialState)
}
