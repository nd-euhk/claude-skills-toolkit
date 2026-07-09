#!/usr/bin/env bash
#
# run-telemetry.sh — Khởi động telemetry collector + Claude Code
#
# Đọc OTLP endpoint config từ settings.json hoặc env var,
# start collector server, set OTEL env vars, chạy Claude Code,
# cleanup server khi Claude Code thoát.
#
# Usage:
#   ./scripts/run-telemetry.sh [claude args...]
#   ./scripts/run-telemetry.sh -p "Review this PR"
#   ./scripts/run-telemetry.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COLLECTOR="$SCRIPT_DIR/telemetry-collector.js"
PID_FILE="$REPO_ROOT/.logs/telemetry-server.pid"
LOCAL_SETTINGS="$REPO_ROOT/.claude/settings.local.json"
PROJECT_SETTINGS="$REPO_ROOT/.claude/settings.json"
USER_SETTINGS="$HOME/.claude/settings.json"

# ── Màu sắc ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[telemetry]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[telemetry]${NC} $*"; }
log_error() { echo -e "${RED}[telemetry]${NC} $*" >&2; }

# ── Đọc endpoint từ config ─────────────────────────────────────────

read_endpoint_from_env() {
    if [[ -n "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
        echo "$OTEL_EXPORTER_OTLP_ENDPOINT"
        return 0
    fi
    return 1
}

read_endpoint_from_settings() {
    local file="$1"
    if [[ -f "$file" ]]; then
        python3 -c "
import json, sys
try:
    with open('$file') as f:
        d = json.load(f)
    ep = d.get('env', {}).get('OTEL_EXPORTER_OTLP_ENDPOINT', '')
    if ep:
        print(ep)
        sys.exit(0)
except:
    pass
sys.exit(1)
" 2>/dev/null && return 0 || true
    fi
    return 1
}

# ── Extract port từ URL ────────────────────────────────────────────

extract_port() {
    local url="$1"
    # http://localhost:4318 → 4318
    # http://localhost:4318/ → 4318
    # https://host:9999/v1/traces → 9999
    # localhost:4318 → 4318
    local port
    port=$(echo "$url" | sed -n 's|.*:\([0-9]\{1,5\}\)[^0-9]*$|\1|p')
    if [[ -z "$port" ]]; then
        # Default OTLP ports by protocol
        if [[ "$url" == *"4317"* ]] || [[ "$url" == *"grpc"* ]]; then
            port=4317
        else
            port=4318
        fi
    fi
    echo "$port"
}

# ── Resolve endpoint và port ───────────────────────────────────────

ENDPOINT=""
PORT=""

# Priority: env var > local settings > project settings > user settings > default
if endpoint=$(read_endpoint_from_env); then
    log_info "Endpoint từ env: $endpoint"
    ENDPOINT="$endpoint"
elif endpoint=$(read_endpoint_from_settings "$LOCAL_SETTINGS"); then
    log_info "Endpoint từ local settings: $endpoint"
    ENDPOINT="$endpoint"
elif endpoint=$(read_endpoint_from_settings "$PROJECT_SETTINGS"); then
    log_info "Endpoint từ project settings: $endpoint"
    ENDPOINT="$endpoint"
elif endpoint=$(read_endpoint_from_settings "$USER_SETTINGS"); then
    log_info "Endpoint từ user settings: $endpoint"
    ENDPOINT="$endpoint"
else
    ENDPOINT="http://localhost:4318"
    log_info "Endpoint mặc định: $ENDPOINT"
fi

PORT=$(extract_port "$ENDPOINT")
log_info "Port: $PORT"

# ── Kiểm tra server đã chạy chưa ────────────────────────────────────

server_alive() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    # Fallback: check port
    if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# ── Cleanup khi exit ────────────────────────────────────────────────

cleanup() {
    local exit_code=$?
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping collector server (PID $pid)..."
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
            rm -f "$PID_FILE"
        fi
    fi
    exit $exit_code
}

trap cleanup EXIT INT TERM

# ── Start server ────────────────────────────────────────────────────

if server_alive; then
    log_warn "Server đã chạy trên port $PORT, dùng lại."
else
    log_info "Khởi động telemetry collector trên port $PORT..."
    node "$COLLECTOR" "$PORT" &

    # Đợi server ready (tối đa 5 giây)
    for i in {1..50}; do
        if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            log_info "Server ready."
            break
        fi
        sleep 0.1
    done

    if ! server_alive; then
        log_error "Server không khởi động được!"
        exit 1
    fi
fi

# ── Set OTEL env vars ───────────────────────────────────────────────

export CLAUDE_CODE_ENABLE_TELEMETRY=1
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1

export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp

export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT="$ENDPOINT"

# Đảm bảo logs/metrics endpoint khớp nếu cấu hình riêng
if [[ -z "${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-}" ]]; then
    export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT="$ENDPOINT/v1/metrics"
fi
if [[ -z "${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-}" ]]; then
    export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="$ENDPOINT/v1/logs"
fi
if [[ -z "${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:-}" ]]; then
    export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="$ENDPOINT/v1/traces"
fi

# Detail level — có thể ghi đè qua env trước khi chạy script
export OTEL_LOG_TOOL_DETAILS="${OTEL_LOG_TOOL_DETAILS:-1}"

log_info "OTEL env đã set:"
log_info "  CLAUDE_CODE_ENABLE_TELEMETRY=$CLAUDE_CODE_ENABLE_TELEMETRY"
log_info "  OTEL_EXPORTER_OTLP_ENDPOINT=$OTEL_EXPORTER_OTLP_ENDPOINT"
log_info "  OTEL_EXPORTER_OTLP_PROTOCOL=$OTEL_EXPORTER_OTLP_PROTOCOL"

# ── Chạy Claude Code ────────────────────────────────────────────────

echo ""
log_info "Khởi động Claude Code..."
echo ""

exec claude "$@"
