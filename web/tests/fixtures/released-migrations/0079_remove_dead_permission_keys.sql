-- Remove permission keys that no code path evaluates. Role and account management is
-- authorized by iam:read / iam:write, and no route reads api_token or access_review keys.

DELETE FROM system_iam_role_permissions
WHERE permission_key IN (
  'iam:manage_roles',
  'iam:assign_roles',
  'api_token:manage',
  'access_review:view'
);
