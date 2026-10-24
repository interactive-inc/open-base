import {
  BootstrapSystemRoot,
  type BootstrapSystemRootCommand,
  type SystemPasswordHasher,
} from "@system/application/iam/bootstrap-system-root"
import { D1SystemRootBootstrapAdapter } from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"

/** Systemの初期管理者を作成し、再実行時は現在の初期状態を返す。 */
export function bootstrapSystemRoot(
  database: D1Database,
  passwordHasher: SystemPasswordHasher,
  command: BootstrapSystemRootCommand,
) {
  return new BootstrapSystemRoot({
    passwordHasher,
    repository: new D1SystemRootBootstrapAdapter({ env: { DB: database } }),
  }).execute(command)
}
