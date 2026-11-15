-- root は managed で後から変更できないため、オプトインの顧客・商品サービス・受託案件を有効にしても
-- 管理者が台帳を扱えない。root を持つ人が一人だと自己付与禁止で詰むので、root に直接含める。
-- D1 は複合 SELECT の項の数に上限があるので、台帳ごとに分けて入れる。
INSERT OR IGNORE INTO system_iam_role_permissions (role_id, permission_key)
SELECT id, permission_key
FROM system_iam_roles
CROSS JOIN (
  SELECT 'customer:read' AS permission_key
  UNION ALL SELECT 'customer:write'
  UNION ALL SELECT 'offering:read'
  UNION ALL SELECT 'offering:write'
)
WHERE key = 'company:root';
--> statement-breakpoint
INSERT OR IGNORE INTO system_iam_role_permissions (role_id, permission_key)
SELECT id, permission_key
FROM system_iam_roles
CROSS JOIN (
  SELECT 'client_project:read' AS permission_key
  UNION ALL SELECT 'client_project:write'
  UNION ALL SELECT 'client_project:record'
)
WHERE key = 'company:root';
