type Context = D1Database

export type ResponsibilitySource = Readonly<{
  organizationId: string
  sourceContext: string
  sourceKind: string
}>

export type ResponsibilitySourceAdoption = ResponsibilitySource &
  Readonly<{
    sourceNamespace: string
    freezeId: string
    sourceId: string
    snapshotDigest: string
    sourceJson: string
    commandId: string
    resourceId: string
    resourceRevision: number
    actorAccountId: string
    reason: string
    expectedRevision: number
    organizationRevision: number
    recordedAt: number
  }>

export type ResponsibilitySourceCutover = ResponsibilitySource &
  Readonly<{
    sourceNamespace: string
    freezeId: string
    sourceCount: number
    manifestDigest: string
    manifestJson: string
    auditEventId: string
    actorAccountId: string
    completedAt: number
  }>

/**
 * 業務の保存元から公開の責務履歴へ接続した記録と、接続完了の受領記録を保存する。
 * 保存元の種類は呼び出し側が渡し、Companyは業務の語彙を持たない。
 */
export class ResponsibilitySourceLedgerAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 責務resourceの保存と同じbatchへ入れる、接続記録のstatementを返す。 */
  prepareAdoption(adoption: ResponsibilitySourceAdoption): D1PreparedStatement {
    return this.c
      .prepare(`INSERT INTO company_responsibility_source_adoptions
        (organization_id, source_context, source_kind, source_namespace, freeze_id, source_id, source_version,
         command_id, resource_type, resource_id, resource_revision, snapshot_digest, source_json,
         actor_account_id, reason, expected_revision, organization_revision, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
         'responsibility-assignment', ?9, ?10, ?7, ?11, ?12, ?13, ?14, ?15, ?16)`)
      .bind(
        adoption.organizationId,
        adoption.sourceContext,
        adoption.sourceKind,
        adoption.sourceNamespace,
        adoption.freezeId,
        adoption.sourceId,
        adoption.snapshotDigest,
        adoption.commandId,
        adoption.resourceId,
        adoption.resourceRevision,
        adoption.sourceJson,
        adoption.actorAccountId,
        adoption.reason,
        adoption.expectedRevision,
        adoption.organizationRevision,
        adoption.recordedAt,
      )
  }

  /** 停止世代で接続した保存元のIDと版を、数値順、次に文字列順で返す。 */
  async listAdoptedSources(
    input: ResponsibilitySource & Readonly<{ sourceNamespace: string; freezeId: string }>,
  ): Promise<ReadonlyArray<Record<string, unknown>>> {
    const rows = await this.c
      .prepare(`SELECT source_id AS sourceId, source_version AS sourceVersion
      FROM company_responsibility_source_adoptions
      WHERE organization_id = ?1 AND source_context = ?2
        AND source_kind = ?3 AND source_namespace = ?4 AND freeze_id = ?5
      ORDER BY CAST(source_id AS INTEGER), source_id`)
      .bind(
        input.organizationId,
        input.sourceContext,
        input.sourceKind,
        input.sourceNamespace,
        input.freezeId,
      )
      .all()
    return rows.results
  }

  async findCutover(input: ResponsibilitySource): Promise<Record<string, unknown> | null> {
    return this.c
      .prepare(`SELECT freeze_id, source_count, adopted_count,
      source_manifest_digest, completed_at FROM company_responsibility_source_cutovers
      WHERE organization_id = ?1 AND source_context = ?2 AND source_kind = ?3`)
      .bind(input.organizationId, input.sourceContext, input.sourceKind)
      .first()
  }

  /** 保存元の全件を接続した受領記録のstatementを返す。接続件数は保存元の件数と同じ値を保存する。 */
  prepareCutover(cutover: ResponsibilitySourceCutover): D1PreparedStatement {
    return this.c
      .prepare(`INSERT INTO company_responsibility_source_cutovers
      (organization_id, source_context, source_kind, source_namespace, freeze_id, source_count,
       adopted_count, source_manifest_digest, source_manifest_json, audit_event_id, actor_account_id, completed_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7, ?8, ?9, ?10, ?11)`)
      .bind(
        cutover.organizationId,
        cutover.sourceContext,
        cutover.sourceKind,
        cutover.sourceNamespace,
        cutover.freezeId,
        cutover.sourceCount,
        cutover.manifestDigest,
        cutover.manifestJson,
        cutover.auditEventId,
        cutover.actorAccountId,
        cutover.completedAt,
      )
  }
}
