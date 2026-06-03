#!/usr/bin/env python3
"""
Aggregate benchmark data for subagent-tester evaluations.

Usage: python aggregate_benchmark.py <path/to/iteration-N>
Reads all eval-N/{with_subagent,baseline}/{grading,timing}.json
Outputs: benchmark.json with aggregated stats.

Adapted from skill-tester/scripts/aggregate_benchmark.rb
for subagent evaluation (with_subagent vs baseline).
"""

import json
import os
import sys
from datetime import datetime, timezone


def main():
    if len(sys.argv) < 2:
        print("Usage: python aggregate_benchmark.py <path/to/iteration-N>")
        print("Example: python aggregate_benchmark.py ./evals/code-reviewer/workspace/iteration-1")
        sys.exit(1)

    iteration_path = sys.argv[1]

    if not os.path.isdir(iteration_path):
        print(f"Error: Directory not found: {iteration_path}")
        sys.exit(1)

    # Discover all eval directories (eval-1, eval-2, etc.)
    eval_dirs = sorted(
        os.path.join(iteration_path, d)
        for d in os.listdir(iteration_path)
        if d.startswith("eval-") and os.path.isdir(os.path.join(iteration_path, d))
    )

    if not eval_dirs:
        print(f"Error: No eval-* directories found in {iteration_path}")
        sys.exit(1)

    # Extract iteration number from path (e.g., iteration-2 -> 2)
    import re
    match = re.search(r'iteration-(\d+)', os.path.basename(iteration_path))
    iteration_num = int(match.group(1)) if match else 1

    # Initialize benchmark structure
    benchmark = {
        "subagent_name": "",
        "iteration": iteration_num,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "evals": [],
        "summary": {
            "with_subagent_avg_pass_rate": 0.0,
            "baseline_avg_pass_rate": 0.0,
            "improvement": 0.0,
            "avg_tokens_with_subagent": 0,
            "avg_tokens_baseline": 0,
            "token_cost": 0,
            "avg_duration_ms_with_subagent": 0,
            "avg_duration_ms_baseline": 0,
        },
    }

    with_subagent_pass_rates = []
    baseline_pass_rates = []
    with_subagent_tokens_list = []
    baseline_tokens_list = []
    with_subagent_durations = []
    baseline_durations = []

    for eval_dir in eval_dirs:
        match = re.search(r'eval-(\d+)', os.path.basename(eval_dir))
        eval_id = int(match.group(1)) if match else 0

        with_subagent_grading_path = os.path.join(eval_dir, "with_subagent", "grading.json")
        with_subagent_timing_path = os.path.join(eval_dir, "with_subagent", "timing.json")
        baseline_grading_path = os.path.join(eval_dir, "baseline", "grading.json")
        baseline_timing_path = os.path.join(eval_dir, "baseline", "timing.json")

        # Read grading and timing data
        def read_json(path):
            if os.path.isfile(path):
                with open(path, "r") as f:
                    return json.load(f)
            return {}

        ws_grading = read_json(with_subagent_grading_path)
        ws_timing = read_json(with_subagent_timing_path)
        bl_grading = read_json(baseline_grading_path)
        bl_timing = read_json(baseline_timing_path)

        # Extract metrics
        ws_pass_rate = ws_grading.get("summary", {}).get("pass_rate", 0.0)
        bl_pass_rate = bl_grading.get("summary", {}).get("pass_rate", 0.0)
        ws_tokens = ws_timing.get("total_tokens", 0)
        bl_tokens = bl_timing.get("total_tokens", 0)
        ws_duration = ws_timing.get("duration_ms", 0)
        bl_duration = bl_timing.get("duration_ms", 0)

        # Build eval result
        eval_result = {
            "eval_id": eval_id,
            "with_subagent": {
                "pass_rate": ws_pass_rate,
                "assertions_passed": ws_grading.get("summary", {}).get("assertions_passed", 0),
                "assertions_total": ws_grading.get("summary", {}).get("assertions_total", 0),
                "avg_tokens": ws_tokens,
                "avg_duration_ms": ws_duration,
            },
            "baseline": {
                "pass_rate": bl_pass_rate,
                "assertions_passed": bl_grading.get("summary", {}).get("assertions_passed", 0),
                "assertions_total": bl_grading.get("summary", {}).get("assertions_total", 0),
                "avg_tokens": bl_tokens,
                "avg_duration_ms": bl_duration,
            },
            "delta": {
                "pass_rate": round(ws_pass_rate - bl_pass_rate, 4),
                "tokens": ws_tokens - bl_tokens,
                "duration_ms": ws_duration - bl_duration,
            },
        }

        benchmark["evals"].append(eval_result)

        with_subagent_pass_rates.append(ws_pass_rate)
        baseline_pass_rates.append(bl_pass_rate)
        with_subagent_tokens_list.append(ws_tokens)
        baseline_tokens_list.append(bl_tokens)
        with_subagent_durations.append(ws_duration)
        baseline_durations.append(bl_duration)

    # Calculate summary statistics
    def safe_avg(values):
        return round(sum(values) / len(values), 4) if values else 0.0

    def safe_avg_int(values):
        return round(sum(values) / len(values)) if values else 0

    avg_ws_pass_rate = safe_avg(with_subagent_pass_rates)
    avg_bl_pass_rate = safe_avg(baseline_pass_rates)
    improvement = round(avg_ws_pass_rate - avg_bl_pass_rate, 4)

    avg_ws_tokens = safe_avg_int(with_subagent_tokens_list)
    avg_bl_tokens = safe_avg_int(baseline_tokens_list)
    avg_ws_duration = safe_avg_int(with_subagent_durations)
    avg_bl_duration = safe_avg_int(baseline_durations)

    benchmark["summary"] = {
        "with_subagent_avg_pass_rate": avg_ws_pass_rate,
        "baseline_avg_pass_rate": avg_bl_pass_rate,
        "improvement": improvement,
        "avg_tokens_with_subagent": avg_ws_tokens,
        "avg_tokens_baseline": avg_bl_tokens,
        "token_cost": avg_ws_tokens - avg_bl_tokens,
        "avg_duration_ms_with_subagent": avg_ws_duration,
        "avg_duration_ms_baseline": avg_bl_duration,
        "duration_cost_ms": avg_ws_duration - avg_bl_duration,
    }

    # Write benchmark.json
    benchmark_path = os.path.join(iteration_path, "benchmark.json")
    with open(benchmark_path, "w") as f:
        json.dump(benchmark, f, indent=2)

    print(f"✓ Benchmark aggregated: {benchmark_path}")
    print()
    print("Summary:")
    print(f"  Evals processed: {len(benchmark['evals'])}")
    print(f"  With Subagent pass rate: {avg_ws_pass_rate * 100:.1f}%")
    print(f"  Baseline pass rate: {avg_bl_pass_rate * 100:.1f}%")
    print(f"  Improvement: +{improvement * 100:.1f} percentage points")

    token_cost = avg_ws_tokens - avg_bl_tokens
    token_cost_str = f"+{token_cost}" if token_cost > 0 else str(token_cost)
    print(f"  Token cost: {token_cost_str}")

    duration_cost = avg_ws_duration - avg_bl_duration
    duration_cost_str = f"+{duration_cost}" if duration_cost > 0 else str(duration_cost)
    print(f"  Duration cost: {duration_cost_str}ms")


if __name__ == "__main__":
    main()
