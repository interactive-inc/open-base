-- 標準利用者の自己申請を、System手続きへの提出にも適用する。
-- 判断資格や承認規程の管理権限は付与しない。
INSERT INTO system_iam_role_permissions (role_id, permission_key)
SELECT id, 'leave:submit' FROM system_iam_roles
WHERE kind = 'managed' AND key IN ('company:member', 'company:manager', 'company:hr', 'company:root')
  AND NOT EXISTS (
    SELECT 1 FROM system_iam_role_permissions permission
    WHERE permission.role_id = system_iam_roles.id AND permission.permission_key = 'leave:submit'
  );
