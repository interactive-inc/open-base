-- root は managed で後から変更できないため、オプトインの work-execution を有効にしても
-- 管理者が業務台帳を扱えない。root を持つ人が一人だと自己付与禁止で詰むので、root に直接含める。
INSERT OR IGNORE INTO system_iam_role_permissions (role_id, permission_key)
SELECT id, permission_key
FROM system_iam_roles
CROSS JOIN (
  SELECT 'work_execution:read' AS permission_key
  UNION ALL SELECT 'work_execution:manage'
  UNION ALL SELECT 'work_execution:record'
)
WHERE key = 'company:root';
