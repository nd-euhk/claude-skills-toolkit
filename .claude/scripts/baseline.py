#!/usr/bin/env python3
"""
baseline.py — SDLC Harness: Test Suite Baseline Capture & Comparison.

Standardizes baseline capture across ALL TDD agents. Instead of each gate agent
parsing test output in its own way, this script provides a SINGLE consistent
format for baseline capture, TC indexing, and interference comparison.

Modes:
  capture   Run tests + parse output → standardized baseline JSON
  parse     Parse existing test output → baseline JSON (tests already run)
  list-tcs  Print TC index (1→N) from a baseline file (for RED agents)
  compare   Baseline vs current → INTERFERENCE-FULL detection

Supported frameworks:
  - JUnit XML   (Gradle: build/test-results/test/TEST-*.xml,
                 Maven:  target/surefire-reports/TEST-*.xml)
  - Jest JSON   (npx jest --json --outputFile=...)
  - Vitest JSON (npx vitest run --reporter=json --outputFile=...)
  - pytest JSON (python -m pytest --json-report --json-report-file=...)
  - Go JSON     (go test ./... -v -json)
  - Rust text   (cargo test -- -Z unstable-options --format json 2>/dev/null)

Usage:
  python baseline.py capture \
      --framework junit-xml \
      --test-output-dir build/test-results/test/ \
      --fr-id FR-001 --layer be --service user-service

  python baseline.py parse \
      --framework vitest-json \
      --input /tmp/baseline-raw.json \
      --fr-id FR-001 --layer fe --app dashboard

  python baseline.py list-tcs \
      --baseline .work/baselines/20260709-FR-001-BE.json

  python baseline.py compare \
      --baseline .work/baselines/20260709-FR-001-BE.json \
      --current /tmp/current-results.json \
      --framework vitest-json

Output — Standardized baseline JSON:
{
  "schema_version": "1.0",
  "feature": "FR-001",
  "layer": "be",
  "service": "user-service",
  "captured_at": "2026-07-09T10:30:00+07:00",
  "framework": "gradle-junit5",
  "test_command": "./gradlew :user-service:test",
  "summary": {"total": 45, "passed": 42, "failed": 2, "skipped": 1},
  "tests": [
    {
      "id": 1,
      "file": "path/to/TestClass.java",
      "method": "testMethodName",
      "class": "TestClass",
      "package": "com.example.service",
      "status": "pass",
      "duration_ms": 120
    }
  ],
  "tc_index": {"1": "TestClass.testMethodName (pass)", ...},
  "pre_existing_failures": [
    {"id": 15, "method": "testFailing", "error": "AssertionError: ..."}
  ],
  "by_file": {
    "path/to/TestClass.java": [1, 2, 3]
  }
}
"""

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ── Framework Parsers ────────────────────────────────────────────────

def parse_junit_xml(test_output_dir: str) -> list[dict]:
    """Parse JUnit XML reports (Gradle: build/test-results/test/TEST-*.xml,
    Maven: target/surefire-reports/TEST-*.xml)."""
    tests = []
    xml_dir = Path(test_output_dir)
    if not xml_dir.exists():
        print(f"ERROR: JUnit XML directory not found: {test_output_dir}", file=sys.stderr)
        sys.exit(1)

    xml_files = sorted(xml_dir.glob("TEST-*.xml"))
    if not xml_files:
        print(f"ERROR: No TEST-*.xml files found in {test_output_dir}", file=sys.stderr)
        sys.exit(1)

    for xml_file in xml_files:
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            classname = root.get("name", xml_file.stem.replace("TEST-", ""))
            for testcase in root.findall("testcase"):
                method = testcase.get("name", "")
                duration = float(testcase.get("time", 0)) * 1000
                failure = testcase.find("failure")
                error = testcase.find("error")
                skipped = testcase.find("skipped")

                if failure is not None or error is not None:
                    status = "fail"
                    error_msg = (failure.get("message", "") if failure is not None
                                 else error.get("message", ""))
                elif skipped is not None:
                    status = "skip"
                    error_msg = skipped.get("message", "")
                else:
                    status = "pass"
                    error_msg = ""

                tests.append({
                    "file": classname.replace(".", "/") + ".java",
                    "method": method,
                    "class": classname.split(".")[-1] if "." in classname else classname,
                    "package": ".".join(classname.split(".")[:-1]) if "." in classname else "",
                    "status": status,
                    "duration_ms": round(duration, 1),
                    "error": error_msg,
                })
        except ET.ParseError as e:
            print(f"WARNING: Failed to parse {xml_file}: {e}", file=sys.stderr)
            continue

    return tests


def parse_jest_json(input_file: str) -> list[dict]:
    """Parse Jest JSON output (npx jest --json --outputFile=...)."""
    with open(input_file) as f:
        data = json.load(f)

    tests = []
    for suite in data.get("testResults", []):
        file_path = suite.get("name", "")
        for tc in suite.get("assertionResults", []):
            status = tc.get("status", "unknown")
            tests.append({
                "file": file_path,
                "method": tc.get("fullName", tc.get("title", "")),
                "class": tc.get("ancestorTitles", [""])[-1] if tc.get("ancestorTitles") else "",
                "status": _map_jest_status(status),
                "duration_ms": tc.get("duration", 0) or 0,
                "error": _extract_jest_error(tc),
            })
    return tests


def parse_vitest_json(input_file: str) -> list[dict]:
    """Parse Vitest JSON output (npx vitest run --reporter=json --outputFile=...)."""
    with open(input_file) as f:
        data = json.load(f)

    tests = []
    for suite in data.get("testResults", []):
        file_path = suite.get("name", "")
        for tc in suite.get("assertionResults", []):
            status = tc.get("status", "unknown")
            tests.append({
                "file": file_path,
                "method": tc.get("fullName", tc.get("title", "")),
                "class": tc.get("ancestorTitles", [""])[-1] if tc.get("ancestorTitles") else "",
                "status": _map_vitest_status(status),
                "duration_ms": tc.get("duration", 0) or 0,
                "error": _extract_vitest_error(tc),
            })
    return tests


def parse_pytest_json(input_file: str) -> list[dict]:
    """Parse pytest JSON report (python -m pytest --json-report --json-report-file=...)."""
    with open(input_file) as f:
        data = json.load(f)

    tests = []
    for tc in data.get("tests", []):
        outcome = tc.get("outcome", "unknown")
        nodeid = tc.get("nodeid", "")
        parts = nodeid.split("::")
        file_path = parts[0] if parts else ""
        method = "::".join(parts[1:]) if len(parts) > 1 else nodeid
        class_name = parts[1] if len(parts) > 2 else ""

        tests.append({
            "file": file_path,
            "method": method,
            "class": class_name,
            "status": _map_pytest_outcome(outcome),
            "duration_ms": round(tc.get("duration", 0) * 1000, 1) if tc.get("duration") else 0,
            "error": tc.get("call", {}).get("longrepr", ""),
        })
    return tests


def parse_go_json(input_file: str) -> list[dict]:
    """Parse go test JSON output (go test ./... -v -json)."""
    tests = []
    with open(input_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue
            if evt.get("Action") == "pass" and "Test" in (evt.get("Test") or ""):
                tests.append({
                    "file": evt.get("Package", ""),
                    "method": evt.get("Test", ""),
                    "class": evt.get("Package", "").split("/")[-1],
                    "status": "pass",
                    "duration_ms": round(evt.get("Elapsed", 0) * 1000, 1),
                    "error": "",
                })
            elif evt.get("Action") == "fail" and "Test" in (evt.get("Test") or ""):
                tests.append({
                    "file": evt.get("Package", ""),
                    "method": evt.get("Test", ""),
                    "class": evt.get("Package", "").split("/")[-1],
                    "status": "fail",
                    "duration_ms": round(evt.get("Elapsed", 0) * 1000, 1),
                    "error": evt.get("Output", ""),
                })
            elif evt.get("Action") == "skip" and "Test" in (evt.get("Test") or ""):
                tests.append({
                    "file": evt.get("Package", ""),
                    "method": evt.get("Test", ""),
                    "class": evt.get("Package", "").split("/")[-1],
                    "status": "skip",
                    "duration_ms": 0,
                    "error": evt.get("Output", ""),
                })
    return tests


def parse_rust_text(input_file: str) -> list[dict]:
    """Parse cargo test text output (cargo test -- -Z unstable-options --format json
    or fallback to verbose text parsing)."""
    tests = []
    # Try JSON format first
    with open(input_file) as f:
        content = f.read()

    if content.strip().startswith("{"):
        for line in content.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue
            if evt.get("type") == "test" and evt.get("event") in ("ok", "failed"):
                tests.append({
                    "file": evt.get("name", "").split("::")[0] if "::" in evt.get("name", "") else "",
                    "method": evt.get("name", ""),
                    "class": "",
                    "status": "pass" if evt.get("event") == "ok" else "fail",
                    "duration_ms": round(evt.get("exec_time", 0) * 1000, 1) if evt.get("exec_time") else 0,
                    "error": evt.get("stdout", ""),
                })
    else:
        # Fallback: parse verbose text output
        test_pattern = re.compile(
            r"test\s+(?P<method>\S+)\s+\.\.\.\s+(?P<status>ok|FAILED|ignored)"
        )
        for match in test_pattern.finditer(content):
            status_map = {"ok": "pass", "FAILED": "fail", "ignored": "skip"}
            tests.append({
                "file": "",
                "method": match.group("method"),
                "class": "",
                "status": status_map.get(match.group("status"), "unknown"),
                "duration_ms": 0,
                "error": "",
            })
    return tests


# ── Helpers ───────────────────────────────────────────────────────────

def _map_jest_status(s: str) -> str:
    m = {"passed": "pass", "failed": "fail", "skipped": "skip", "pending": "skip", "todo": "skip"}
    return m.get(s, s)


def _map_vitest_status(s: str) -> str:
    m = {"passed": "pass", "failed": "fail", "skipped": "skip", "pending": "skip", "todo": "skip"}
    return m.get(s, s)


def _map_pytest_outcome(s: str) -> str:
    m = {"passed": "pass", "failed": "fail", "skipped": "skip", "xfailed": "pass",
         "xpassed": "fail", "error": "fail"}
    return m.get(s, s)


def _extract_jest_error(tc: dict) -> str:
    msgs = tc.get("failureMessages", [])
    return msgs[0] if msgs else ""


def _extract_vitest_error(tc: dict) -> str:
    msgs = tc.get("failureMessages", [])
    return msgs[0] if msgs else ""


# ── Parser registry ───────────────────────────────────────────────────

PARSERS = {
    "junit-xml":     parse_junit_xml,
    "jest-json":     parse_jest_json,
    "vitest-json":   parse_vitest_json,
    "pytest-json":   parse_pytest_json,
    "go-json":       parse_go_json,
    "rust-text":     parse_rust_text,
}


# ── Baseline Construction ──────────────────────────────────────────────

def build_baseline(
    tests: list[dict],
    fr_id: str,
    layer: str,
    service: str = "",
    app: str = "",
    framework: str = "",
    test_command: str = "",
) -> dict:
    """Assign TC IDs (1→N), build index, classify pre-existing failures."""
    # Sort by file then method for deterministic ordering
    tests_sorted = sorted(tests, key=lambda t: (t.get("file", ""), t.get("method", "")))

    # Assign sequential IDs
    for i, tc in enumerate(tests_sorted, 1):
        tc["id"] = i

    summary = {
        "total": len(tests_sorted),
        "passed": sum(1 for t in tests_sorted if t["status"] == "pass"),
        "failed": sum(1 for t in tests_sorted if t["status"] == "fail"),
        "skipped": sum(1 for t in tests_sorted if t["status"] == "skip"),
    }

    tc_index = {}
    for tc in tests_sorted:
        label = f"{tc['method']}"
        suffix = f" ({tc['status']})"
        tc_index[str(tc["id"])] = label + suffix

    by_file: dict[str, list[int]] = {}
    for tc in tests_sorted:
        fname = tc.get("file", "(unknown)")
        by_file.setdefault(fname, []).append(tc["id"])

    pre_existing_failures = [
        {"id": t["id"], "method": t["method"], "file": t.get("file", ""), "error": t.get("error", "")}
        for t in tests_sorted if t["status"] == "fail"
    ]

    now_iso = datetime.now(timezone.utc).isoformat()

    baseline = {
        "schema_version": "1.0",
        "feature": fr_id,
        "layer": layer,
        "captured_at": now_iso,
        "framework": framework,
        "test_command": test_command,
        "summary": summary,
        "tests": tests_sorted,
        "tc_index": tc_index,
        "pre_existing_failures": pre_existing_failures,
        "by_file": by_file,
    }
    if service:
        baseline["service"] = service
    if app:
        baseline["app"] = app

    return baseline


# ── Output Helpers ────────────────────────────────────────────────────

def write_baseline(baseline: dict, output_path: str, dry_run: bool = False) -> str:
    """Write baseline JSON to file. Returns the file path."""
    if dry_run:
        print(json.dumps(baseline, indent=2, ensure_ascii=False))
        return "(stdout)"

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(baseline, f, indent=2, ensure_ascii=False)
    return str(path)


def print_tc_index(baseline: dict) -> None:
    """Print TC index in human + machine-readable format."""
    print(f"Feature: {baseline['feature']}  Layer: {baseline['layer']}  "
          f"Framework: {baseline.get('framework', 'N/A')}")
    print(f"Captured: {baseline['captured_at']}")
    print(f"Summary: {baseline['summary']['total']} total, "
          f"{baseline['summary']['passed']} passed, "
          f"{baseline['summary']['failed']} failed, "
          f"{baseline['summary']['skipped']} skipped")
    print()

    # Pre-existing failures warning
    pre = baseline.get("pre_existing_failures", [])
    if pre:
        print(f"⚠️  PRE-EXISTING FAILURES ({len(pre)}):")
        for f in pre:
            print(f"  TC-{f['id']}: {f['method']} ({f.get('file', '?')})")
            if f.get("error"):
                print(f"       {f['error'][:120]}")
        print()

    # TC list by file
    by_file = baseline.get("by_file", {})
    for fname, tc_ids in by_file.items():
        print(f"📄 {fname} ({len(tc_ids)} tests)")
        for tid in tc_ids:
            tc = next((t for t in baseline["tests"] if t["id"] == tid), None)
            if tc:
                icon = {"pass": "✅", "fail": "❌", "skip": "⏭️"}.get(tc["status"], "❓")
                dur = f" ({tc['duration_ms']}ms)" if tc.get("duration_ms") else ""
                print(f"  {icon} TC-{tid}: {tc['method']}{dur}")
        print()


def print_interference_report(
    baseline: dict, current_tests: list[dict], culprit_tc_info: str = ""
) -> int:
    """Compare baseline vs current, print interference report.
    Returns count of interference hits (0 = clean)."""
    # Build lookup from baseline: (file, method) → status
    baseline_map: dict[tuple[str, str], dict] = {}
    for tc in baseline["tests"]:
        key = (tc.get("file", ""), tc.get("method", ""))
        baseline_map[key] = tc

    # Build lookup from current
    current_map: dict[tuple[str, str], dict] = {}
    for tc in current_tests:
        key = (tc.get("file", ""), tc.get("method", ""))
        current_map[key] = tc

    # Find: was "pass" in baseline, is "fail" or missing now
    interference = []
    for key, bl_tc in baseline_map.items():
        if bl_tc["status"] != "pass":
            continue  # Wasn't passing before — not interference
        cur_tc = current_map.get(key)
        if cur_tc is None:
            # Test existed before but is now missing
            interference.append({
                "baseline_test": bl_tc,
                "current_status": "missing",
                "error": "Test no longer exists in suite",
            })
        elif cur_tc["status"] == "fail":
            interference.append({
                "baseline_test": bl_tc,
                "current_status": "fail",
                "error": cur_tc.get("error", ""),
            })

    if not interference:
        print("✅ INTERFERENCE-FULL: Clean — no broken tests.")
        return 0

    print(f"❌ INTERFERENCE-FULL: {len(interference)} tests broken!\n")
    print(f"{'Broken Test':<45} {'File':<30} {'Baseline':<8} {'Now':<8}")
    print("-" * 95)
    for item in interference:
        bl = item["baseline_test"]
        method = bl["method"][:42]
        fname = bl.get("file", "?")[:28]
        print(f"{method:<45} {fname:<30} pass     {item['current_status']:<8}")

    if culprit_tc_info:
        print(f"\n⚠️  Likely culprit: {culprit_tc_info}")
        print("   Check which TC modified shared files or fixtures.")

    print(f"\n{len(interference)} interference hits total.")
    return len(interference)


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="SDLC Harness: Test Suite Baseline Capture & Comparison"
    )
    sub = parser.add_subparsers(dest="mode", required=True)

    # ── capture ──────────────────────────────────────────────────
    cap = sub.add_parser("capture", help="Run tests and capture baseline")
    cap.add_argument("--framework", required=True, choices=list(PARSERS),
                     help="Test framework output format")
    cap.add_argument("--test-output-dir", default="",
                     help="JUnit XML directory (for junit-xml)")
    cap.add_argument("--input", default="",
                     help="Raw test output file (for JSON/text formats)")
    cap.add_argument("--fr-id", required=True, help="Feature ID, e.g. FR-001")
    cap.add_argument("--layer", required=True, choices=["be", "fe"],
                     help="Backend or frontend layer")
    cap.add_argument("--service", default="", help="Backend service name")
    cap.add_argument("--app", default="", help="Frontend app name")
    cap.add_argument("--test-command", default="",
                     help="Command used to run tests (for record-keeping)")
    cap.add_argument("--output", default="",
                     help="Output path (default: .work/baselines/YYYYMMDD-FR-{ID}-{LAYER}.json)")
    cap.add_argument("--dry-run", action="store_true",
                     help="Print JSON to stdout instead of writing file")

    # ── parse ────────────────────────────────────────────────────
    prs = sub.add_parser("parse", help="Parse existing test output → baseline JSON")
    prs.add_argument("--framework", required=True, choices=list(PARSERS),
                     help="Test framework output format")
    prs.add_argument("--test-output-dir", default="",
                     help="JUnit XML directory (for junit-xml)")
    prs.add_argument("--input", default="",
                     help="Raw test output file (for JSON/text formats)")
    prs.add_argument("--fr-id", required=True, help="Feature ID")
    prs.add_argument("--layer", required=True, choices=["be", "fe"])
    prs.add_argument("--service", default="")
    prs.add_argument("--app", default="")
    prs.add_argument("--test-command", default="")
    prs.add_argument("--output", default="")
    prs.add_argument("--dry-run", action="store_true")

    # ── list-tcs ─────────────────────────────────────────────────
    lst = sub.add_parser("list-tcs", help="Print TC index from a baseline file")
    lst.add_argument("--baseline", required=True,
                     help="Path to baseline JSON file")
    lst.add_argument("--file", default="",
                     help="Filter TCs by file path (substring match)")
    lst.add_argument("--status", default="", choices=["pass", "fail", "skip"],
                     help="Filter by status")
    lst.add_argument("--json", action="store_true",
                     help="Output as machine-readable JSON array of TC IDs")

    # ── compare ──────────────────────────────────────────────────
    cmp = sub.add_parser("compare", help="Baseline vs current → interference report")
    cmp.add_argument("--baseline", required=True,
                     help="Path to baseline JSON file")
    cmp.add_argument("--current", required=True,
                     help="Path to current test results (raw framework output)")
    cmp.add_argument("--framework", required=True, choices=list(PARSERS),
                     help="Framework for parsing current results")
    cmp.add_argument("--culprit", default="",
                     help="Culprit info string (e.g. 'TC-3 modified UserService.java')")
    cmp.add_argument("--json", action="store_true",
                     help="Output as machine-readable JSON")

    args = parser.parse_args()

    # ── Mode: capture / parse ────────────────────────────────────
    if args.mode in ("capture", "parse"):
        if args.framework == "junit-xml":
            if not args.test_output_dir:
                print("ERROR: --test-output-dir required for junit-xml", file=sys.stderr)
                sys.exit(1)
            tests = PARSERS[args.framework](args.test_output_dir)
        else:
            if not args.input:
                print(f"ERROR: --input required for {args.framework}", file=sys.stderr)
                sys.exit(1)
            if not os.path.exists(args.input):
                print(f"ERROR: Input file not found: {args.input}", file=sys.stderr)
                sys.exit(1)
            tests = PARSERS[args.framework](args.input)

        baseline = build_baseline(
            tests=tests,
            fr_id=args.fr_id,
            layer=args.layer,
            service=args.service,
            app=args.app,
            framework=args.framework,
            test_command=args.test_command,
        )

        # Determine output path
        if args.output:
            output_path = args.output
        else:
            today = datetime.now().strftime("%Y%m%d")
            layer_upper = args.layer.upper()
            output_path = f".work/baselines/{today}-{args.fr_id}-{layer_upper}.json"

        written = write_baseline(baseline, output_path, dry_run=args.dry_run)
        if not args.dry_run:
            print(f"✅ Baseline captured: {written}")
            print(f"   {baseline['summary']['total']} tests — "
                  f"{baseline['summary']['passed']} pass, "
                  f"{baseline['summary']['failed']} fail, "
                  f"{baseline['summary']['skipped']} skip")
            if baseline["pre_existing_failures"]:
                print(f"   ⚠️  {len(baseline['pre_existing_failures'])} pre-existing failures")

    # ── Mode: list-tcs ───────────────────────────────────────────
    elif args.mode == "list-tcs":
        with open(args.baseline) as f:
            baseline = json.load(f)

        tests = baseline["tests"]

        # Apply filters
        if args.file:
            tests = [t for t in tests if args.file in t.get("file", "")]
        if args.status:
            tests = [t for t in tests if t["status"] == args.status]

        if args.json:
            # Machine-readable: just TC IDs
            print(json.dumps([t["id"] for t in tests]))
        else:
            print_tc_index(baseline)
            if args.file or args.status:
                print(f"── Filtered: {len(tests)} tests ──")
                for tc in tests:
                    icon = {"pass": "✅", "fail": "❌", "skip": "⏭️"}.get(tc["status"], "❓")
                    print(f"  {icon} TC-{tc['id']}: {tc['method']} ({tc.get('file', '?')})")

    # ── Mode: compare ────────────────────────────────────────────
    elif args.mode == "compare":
        with open(args.baseline) as f:
            baseline = json.load(f)

        # Parse current results
        if args.framework == "junit-xml":
            print("ERROR: compare mode with junit-xml requires --test-output-dir not yet wired; "
                  "pre-parse to JSON first.", file=sys.stderr)
            sys.exit(1)
        else:
            current_tests = PARSERS[args.framework](args.current)

        if args.json:
            # Machine-readable interference report
            baseline_map = {(t.get("file", ""), t.get("method", "")): t
                            for t in baseline["tests"]}
            interference = []
            for ct in current_tests:
                key = (ct.get("file", ""), ct.get("method", ""))
                bl_tc = baseline_map.get(key)
                if bl_tc and bl_tc["status"] == "pass" and ct["status"] == "fail":
                    interference.append({
                        "test": ct["method"],
                        "file": ct.get("file", ""),
                        "baseline_status": "pass",
                        "current_status": "fail",
                        "error": ct.get("error", ""),
                    })
            print(json.dumps(interference, indent=2))
        else:
            count = print_interference_report(baseline, current_tests, args.culprit)
            sys.exit(0 if count == 0 else 1)


if __name__ == "__main__":
    main()
