-- 認証時の訂正履歴照合で、候補行ごとに会社全体の履歴を再走査することを防ぐ。
-- 元の履歴・時点判定は変更せず、訂正対象の一致と会社版の上限を索引内で解決する。
CREATE INDEX company_resource_revisions_correction_idx
  ON company_resource_revisions (
    organization_id, resource_type, resource_id, corrects_revision, organization_revision
  )
  WHERE corrects_revision IS NOT NULL;
