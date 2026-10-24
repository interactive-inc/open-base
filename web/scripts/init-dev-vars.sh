#!/usr/bin/env bash
# ローカル開発用の api/.dev.vars を生成する。秘密値は毎回ランダムに作る。
# 公開リポジトリに実際に使える秘密値を置かないため、.dev.vars.example は
# 秘密値を空にしてある。api はプレースホルダのままの値を実行時に拒否する。
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET=".dev.vars"

if [ -f "$TARGET" ]; then
  echo "$TARGET は既に存在するので変更しない。作り直すなら削除してから再実行する。"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl が見つからない。手で $TARGET を作り、秘密値を 32 文字以上で設定する。" >&2
  exit 1
fi

generate_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

cat >"$TARGET" <<EOF
JWT_SECRET="$(generate_secret)"
AUDIT_HMAC_SECRET="$(generate_secret)"
PEPPER_SECRET="$(generate_secret)"
ATTACHMENT_KEKS='{"1": "$(generate_secret)"}'
COMPANY_TIME_ZONE="Asia/Tokyo"
IDENTITY_JWKS=
IDENTITY_ISSUER=
IDENTITY_AUDIENCE="https://app.base.localhost"
IDENTITY_LOGIN_URL=
API_ORIGIN="https://base.localhost"
BOOTSTRAP_TOKEN="$(generate_secret)"
EOF

chmod 600 "$TARGET"

echo "$TARGET を生成した。署名・暗号鍵はランダム値、PEPPER_SECRET・初期化tokenもランダム値。"
