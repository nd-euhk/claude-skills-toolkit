#!/usr/bin/env python3
"""
persist-cook-report.py — SDLC Harness: persist một COOK_REPORT thành checkpoint per-FR.

Dùng bởi controller sdlc-cook-overnight: sau khi Workflow() trả COOK_REPORT (per feature),
controller gọi script này để ghi checkpoint xuống disk deterministic + atomic — thay vì giữ
trong memory records (mất khi session chết giữa đêm, report cuối chỉ dựng được từ memory).

Đầu vào: COOK_REPORT (JSON) qua stdin — KHÔNG qua argv (payload lớn + shell-quoting).
Ghi ra:  {out-dir}/{frId}-{layer}.json — atomic (tmp + os.replace), tạo dir nếu thiếu.

usage:
  python3 persist-cook-report.py \\
      --out-dir "<workspace>/.work/reports/per-feature" \\
      --layer backend <<'JSON'
  { COOK_REPORT }
  JSON

Exit codes:
  0 — checkpoint đã ghi (stdout = path đã ghi)
  2 — payload invalid / thiếu field bắt buộc / layer sai (stderr = chi tiết)
  1 — lỗi IO khác
"""
import argparse
import json
import os
import re
import sys

VALID_STATUS = ("completed", "partial", "failed")
LAYER_ALIASES = {"backend": "BE", "be": "BE", "frontend": "FE", "fe": "FE", "BE": "BE", "FE": "FE"}


def die(code, msg):
    print(msg, file=sys.stderr)
    sys.exit(code)


def sanitize_token(value, label):
    """Giữ [A-Za-z0-9._-] cho tên file — chặn path traversal từ frId (controller cung cấp)."""
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", value or "").strip("._")
    if not cleaned:
        die(2, f"[persist-cook-report] {label} trống hoặc không hợp lệ sau khi sanitize: {value!r}")
    return cleaned


def validate(payload):
    """Validate schema COOK_REPORT (khớp workflow-sdlc-cook-overnight.js COOK_REPORT schema)."""
    if not isinstance(payload, dict):
        die(2, "[persist-cook-report] Payload không phải object JSON")

    fr_id = payload.get("frId")
    if not isinstance(fr_id, str) or not fr_id.strip():
        die(2, "[persist-cook-report] Thiếu field bắt buộc: frId (string)")

    status = payload.get("status")
    if status not in VALID_STATUS:
        die(2, f"[persist-cook-report] status sai: {status!r} — phải ∈ {VALID_STATUS}")

    tcs = payload.get("tcResults")
    if not isinstance(tcs, list):
        die(2, "[persist-cook-report] Thiếu/sai field bắt buộc: tcResults (array)")

    # Optional fields — validate type nếu hiện diện
    if "warnings" in payload and not isinstance(payload["warnings"], list):
        die(2, "[persist-cook-report] warnings phải là array (hoặc bỏ field)")
    for key in ("summary", "nextStep"):
        if key in payload and not isinstance(payload[key], str):
            die(2, f"[persist-cook-report] {key} phải là string (hoặc bỏ field)")
    for key in ("gateLight", "gateFull", "refactorFull"):
        if key in payload and payload[key] is not None and not isinstance(payload[key], dict):
            die(2, f"[persist-cook-report] {key} phải là object hoặc null")

    return fr_id.strip(), status


def main():
    parser = argparse.ArgumentParser(description="Persist một COOK_REPORT thành checkpoint per-FR (atomic).")
    parser.add_argument("--out-dir", required=True, help="Absolute path tới thư mục checkpoint per-feature (VD $WORKSPACE/.work/reports/per-feature)")
    parser.add_argument("--layer", required=True, help="backend|frontend|be|fe (map sang BE/FE — khớp baseline convention)")
    args = parser.parse_args()

    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        die(2, f"[persist-cook-report] stdin không phải JSON hợp lệ: {e}")

    fr_id, status = validate(payload)
    layer = LAYER_ALIASES.get(args.layer.lower())
    if layer is None:
        die(2, f"[persist-cook-report] --layer sai: {args.layer!r} — phải backend|frontend|be|fe")

    fr_token = sanitize_token(fr_id, "frId")
    filename = f"{fr_token}-{layer}.json"

    try:
        os.makedirs(args.out_dir, exist_ok=True)
    except OSError as e:
        die(1, f"[persist-cook-report] Không tạo được {args.out_dir}: {e}")

    dest = os.path.join(args.out_dir, filename)
    tmp = dest + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, dest)  # atomic — không bao giờ file nửa chừng khi controller crash
    except OSError as e:
        try:
            os.remove(tmp)
        except OSError:
            pass
        die(1, f"[persist-cook-report] Ghi checkpoint {dest} thất bại: {e}")

    print(dest)
    sys.exit(0)


if __name__ == "__main__":
    main()
