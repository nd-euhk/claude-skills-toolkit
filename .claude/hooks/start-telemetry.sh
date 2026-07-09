#!/usr/bin/env bash
#
# Hook: start-telemetry.sh — Khởi động telemetry collector khi session bắt đầu
# Event: SessionStart
#
# Đọc port từ config (local > project > user > default),
# start collector nếu chưa chạy, đợi ready.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COLLECTOR="$REPO_ROOT/.claude/scripts/telemetry-collector.js"
PID_FILE="$REPO_ROOT/.logs/telemetry-server.pid"
LOCAL_SETTINGS="$REPO_ROOT/.claude/settings.local.json"
PROJECT_SETTINGS="$REPO_ROOT/.claude/settings.json"
USER_SETTINGS="$HOME/.claude/settings.json"

# ── Đọc port từ config ──────────────────────────────────────────────

PORT=4318  # default

# Priority: local settings > project settings > user settings > default
for f in "$LOCAL_SETTINGS" "$PROJECT_SETTINGS" "$USER_SETTINGS"; do
  if [ -f "$f" ]; then
    ep=$(python3 -c "
import json, sys
try:
    with open('$f') as fh:
        d = json.load(fh)
    ep = d.get('env', {}).get('OTEL_EXPORTER_OTLP_ENDPOINT', '')
    if ep:
        print(ep)
        sys.exit(0)
except:
    pass
sys.exit(1)
" 2>/dev/null) || true
    if [ -n "$ep" ]; then
      PORT=$(echo "$ep" | sed -n 's|.*:\([0-9]\{1,5\}\)[^0-9]*$|\1|p')
      break
    fi
  fi
done

# ── Kiểm tra server đã chạy chưa ────────────────────────────────────

# Check PID file
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    exit 0  # Đã chạy
  fi
  rm -f "$PID_FILE"  # Stale PID
fi

# Check port fallback
if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
  exit 0  # Server khác đang listen
fi

# ── Khởi động collector ─────────────────────────────────────────────

# Đảm bảo thư mục logs tồn tại
mkdir -p "$REPO_ROOT/.logs"/{spans,metrics,events,sessions}

node "$COLLECTOR" "$PORT" </dev/null >"$REPO_ROOT/.logs/telemetry-server.log" 2>&1 &
COLLECTOR_PID=$!

# Đợi server ready (tối đa 5 giây)
for i in {1..50}; do
  if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
    exit 0
  fi
  sleep 0.1
done

# Nếu server không start được, kill process và báo lỗi
kill "$COLLECTOR_PID" 2>/dev/null || true
echo "[telemetry] WARNING: Collector failed to start on port $PORT" >&2
exit 0  # Không block session vì lỗi telemetry
