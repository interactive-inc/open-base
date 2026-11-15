-- 招待を出したアカウント。受諾の保存で、発行者が今もその役割を渡せるかを確かめるために使う。
-- この列より前の招待は NULL のまま残し、期限まではこれまでどおり受け付ける。
-- アカウントの完全な削除を止めないよう、外部キーは張らない。
ALTER TABLE system_account_invitations ADD COLUMN issued_by_account_id TEXT;
