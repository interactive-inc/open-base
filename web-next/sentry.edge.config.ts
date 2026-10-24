import * as Sentry from "@sentry/nextjs"
import { isAuthError } from "@/lib/api/auth-error"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  beforeSend(event, hint) {
    return isAuthError(hint.originalException) ? null : event
  },
})
