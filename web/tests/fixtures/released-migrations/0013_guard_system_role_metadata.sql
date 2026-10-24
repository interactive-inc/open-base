-- Role の識別情報と権限対象種別を作成後に変更できないようにする。

DROP TRIGGER IF EXISTS system_iam_roles_immutable_identity;

CREATE TRIGGER system_iam_roles_immutable_identity
BEFORE UPDATE OF id, key, kind, resource_type, created_at ON system_iam_roles
BEGIN
  SELECT RAISE(ABORT, 'IAM role identity is immutable');
END;
