import { systemSchema } from "@system/configuration/system-context"

/** 製品DBがSystemの全テーブルとrelationsを登録するためのschema。 */
export function openSystemDatabaseSchema() {
  return systemSchema
}
