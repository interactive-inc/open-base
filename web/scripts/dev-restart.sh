#!/usr/bin/env bash
# wrangler dev は「Network connection lost.」で稀にプロセスごと落ちる。
# portless は落ちたアプリを再起動しないため、ここで落ちたことを目立つように表示して自動で再起動する。
# 意図的な終了（Ctrl-C / 正常終了）では再起動しない。

trap 'exit 0' INT TERM

while true; do
  wrangler dev "$@"
  code=$?

  if [ "$code" -eq 0 ] || [ "$code" -eq 130 ]; then
    exit "$code"
  fi

  echo ""
  echo "=================================================================="
  echo "[dev-restart] wrangler dev が exit code ${code} で落ちました。"
  echo "[dev-restart] 全ページが 404/500 になっていた場合はこれが原因です。"
  echo "[dev-restart] 1 秒後に自動で再起動します（止めるには Ctrl-C）。"
  echo "=================================================================="
  echo ""

  sleep 1
done
