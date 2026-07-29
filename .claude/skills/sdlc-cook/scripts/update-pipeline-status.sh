#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# update-pipeline-status.sh — Atomic update .pipeline/{frId}-status.json
# ─────────────────────────────────────────────────────────────
# Agent gọi script này sau mỗi milestone; script merge key=value
# vào file JSON hiện tại, auto-set updated_at, và atomic write.
#
# Usage:
#   ./update-pipeline-status.sh FR-AUTH-001 status=running tc_current=3 TC-3=DONE
#   ./update-pipeline-status.sh FR-AUTH-001 gate_light=PASS
#   ./update-pipeline-status.sh FR-AUTH-001 --init feature=FEAT-001 service=auth layer=backend
#
# Special keys:
#   --init        Khởi tạo file mới (xóa file cũ nếu có)
#   TC-{N}=VALUE  Ghi vào tc_statuses."TC-{N}"
#   gate_light=VALUE   Ghi vào gate_light.status
#   gate_full=VALUE    Ghi vào gate_full.status
#
# File location:
#   .pipeline/{frId}-status.json  (relative từ repo/project root)
# ─────────────────────────────────────────────────────────────

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <FR-ID> [--init] key=value [key=value ...]" >&2
  exit 1
fi

FR_ID="$1"
shift

# ── Xác định pipeline dir ──
# Walk up từ CWD tìm project root (nơi có .git hoặc .pipeline/)
PIPELINE_DIR=""
CURRENT="$PWD"
while [ "$CURRENT" != "/" ]; do
  if [ -d "$CURRENT/.pipeline" ] || [ -d "$CURRENT/.git" ] || [ -f "$CURRENT/.git" ]; then
    PIPELINE_DIR="$CURRENT/.pipeline"
    break
  fi
  CURRENT="$(dirname "$CURRENT")"
done

if [ -z "$PIPELINE_DIR" ]; then
  # Fallback: dùng CWD
  PIPELINE_DIR="$PWD/.pipeline"
fi

mkdir -p "$PIPELINE_DIR"
STATUS_FILE="$PIPELINE_DIR/${FR_ID}-status.json"
TMP_FILE="$PIPELINE_DIR/.${FR_ID}-status.tmp"

# ── Parse flags ──
DO_INIT=false
declare -A UPDATES
declare -A TC_UPDATES

while [ $# -gt 0 ]; do
  case "$1" in
    --init)
      DO_INIT=true
      shift
      ;;
    TC-[0-9]*=*)
      # TC-3=DONE → lưu riêng để merge vào tc_statuses
      TC_KEY="${1%%=*}"
      TC_VAL="${1#*=}"
      TC_UPDATES["$TC_KEY"]="$TC_VAL"
      shift
      ;;
    gate_light=*)
      UPDATES["gate_light.status"]="${1#*=}"
      shift
      ;;
    gate_full=*)
      UPDATES["gate_full.status"]="${1#*=}"
      shift
      ;;
    refactor_full=*)
      UPDATES["refactor_full.status"]="${1#*=}"
      shift
      ;;
    *=*)
      KEY="${1%%=*}"
      VAL="${1#*=}"
      UPDATES["$KEY"]="$VAL"
      shift
      ;;
    *)
      echo "WARNING: Bỏ qua arg không parse được: $1" >&2
      shift
      ;;
  esac
done

# ── Đọc hiện tại hoặc khởi tạo ──
NOW=$(date -Iseconds 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$DO_INIT" = true ] || [ ! -f "$STATUS_FILE" ]; then
  # Khởi tạo mới
  cat > "$TMP_FILE" <<EOF
{
  "fr_id": "${FR_ID}",
  "started_at": "${NOW}",
  "updated_at": "${NOW}",
  "phase": "TDD",
  "status": "running",
  "tc_current": 0,
  "tc_total": 0,
  "tc_statuses": {},
  "gate_light": null,
  "gate_full": null,
  "refactor_full": null,
  "errors": []
}
EOF
else
  cp "$STATUS_FILE" "$TMP_FILE"
fi

# ── Merge updates dùng python (có sẵn trên mọi system) ──
python3 - "$TMP_FILE" "$NOW" \
  "${#UPDATES[@]}" "${!UPDATES[@]}" "${UPDATES[@]}" \
  "${#TC_UPDATES[@]}" "${!TC_UPDATES[@]}" "${TC_UPDATES[@]}" \
<<'PYEOF'
import json, sys

tmp_file = sys.argv[1]
now = sys.argv[2]

# Parse positional: n_updates, keys..., vals..., n_tc, tc_keys..., tc_vals...
args = sys.argv[3:]
idx = 0

n_updates = int(args[idx]); idx += 1
updates = {}
for _ in range(n_updates):
    k = args[idx]; idx += 1
    v = args[idx]; idx += 1
    updates[k] = v

n_tc = int(args[idx]); idx += 1
tc_updates = {}
for _ in range(n_tc):
    k = args[idx]; idx += 1
    v = args[idx]; idx += 1
    tc_updates[k] = v

with open(tmp_file) as f:
    data = json.load(f)

data['updated_at'] = now

# Merge flat updates
for k, v in updates.items():
    parts = k.split('.')
    target = data
    for p in parts[:-1]:
        if p not in target or target[p] is None:
            target[p] = {}
        target = target[p]
    # Try to preserve type: number, boolean, or string
    if v.lower() == 'true':
        v = True
    elif v.lower() == 'false':
        v = False
    elif v.isdigit():
        v = int(v)
    target[parts[-1]] = v

# Merge tc_statuses
for tc_key, tc_val in tc_updates.items():
    if 'tc_statuses' not in data or data['tc_statuses'] is None:
        data['tc_statuses'] = {}
    data['tc_statuses'][tc_key] = tc_val

# Auto-derive tc_current từ tc_statuses
tc_statuses = data.get('tc_statuses', {}) or {}
running_or_done = sum(1 for v in tc_statuses.values() if v in ('DONE', 'SKIPPED', 'RUNNING'))
if running_or_done > 0:
    data['tc_current'] = running_or_done

# Auto-derive status từ gate/errors
if data.get('errors') and len(data['errors']) > 0:
    data['status'] = 'failed'
elif data.get('gate_full', {}).get('status') == 'PASS':
    data['status'] = 'completed'
elif data.get('gate_light', {}).get('status') == 'PASS':
    data['status'] = 'gate_light_pass'
elif data.get('gate_light', {}).get('status') == 'FAIL':
    data['status'] = 'gate_light_fail'

with open(tmp_file, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PYEOF

# ── Atomic move ──
mv "$TMP_FILE" "$STATUS_FILE"
echo "✅ Updated $STATUS_FILE"
