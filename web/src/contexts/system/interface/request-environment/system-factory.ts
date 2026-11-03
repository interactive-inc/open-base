import type {
  SystemAuthorizationContext,
  SystemAttachmentStorageContext,
  SystemBootstrapContext,
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
  SystemEmailContext,
  SystemExternalIdentityContext,
  SystemJwtSecretContext,
  SystemPasswordHashContext,
  SystemPasswordCredentialResetContext,
  SystemRequestAuditContext,
  SystemSessionConfigurationContext,
} from "@system/configuration/system-context"
import { createFactory } from "hono/factory"
import type { SystemNotificationVisibility } from "@system/interface/ports/system-notification-visibility"
import type { SystemPasswordSessionPolicy } from "@system/interface/ports/system-password-session-policy"

type SystemInterfaceContext = SystemDatabaseContext &
  SystemD1Context &
  SystemAttachmentStorageContext &
  SystemClockContext &
  SystemAuthorizationContext &
  SystemBootstrapContext &
  SystemJwtSecretContext &
  SystemPasswordHashContext &
  SystemPasswordCredentialResetContext &
  SystemSessionConfigurationContext &
  SystemRequestAuditContext &
  SystemEmailContext &
  SystemExternalIdentityContext &
  Readonly<{
    var: Readonly<{
      systemNotificationVisibility?: SystemNotificationVisibility
      systemPasswordSessionPolicy?: SystemPasswordSessionPolicy
    }>
  }>

/** System InterfaceがHonoを利用するための、製品APIから独立した最小Env。 */
export type SystemHonoEnv = Readonly<{
  Bindings: SystemInterfaceContext["env"]
  Variables: SystemInterfaceContext["var"]
}>

export const systemFactory = createFactory<SystemHonoEnv>()
