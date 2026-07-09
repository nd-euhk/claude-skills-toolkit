#!/usr/bin/env bash
#
# Hook: stop-telemetry.sh — Dừng telemetry collector khi session kết thúc
# Event: Stop
#
# Đọc PID file, kill server, dọn dẹp.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_FILE="$REPO_ROOT/.logs/telemetry-server.pid"

if [ ! -f "$PID_FILE" ]; then
  exit 0  # Không có gì để dừng
fi

pid=$(cat "$PID_FILE" 2>/dev/null || true)

if [ -z "$pid" ]; then
  rm -f "$PID_FILE"
  exit 0
fi

# Graceful shutdown
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid" 2>/dev/null || true

  # Đợi tối đa 3 giây
  for i in {1..30}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # Force kill nếu chưa chết
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
fi

rm -f "$PID_FILE"
exit 0
