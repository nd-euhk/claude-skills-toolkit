#!/usr/bin/env node

/**
 * analyze-traces.js — Phân tích telemetry trace data từ .logs/
 *
 * Đọc spans, metrics, events từ .logs/ → generate markdown report.
 *
 * Usage:
 *   node analyze-traces.js [--days N] [--output <path>] [--session <id>]
 *
 * Options:
 *   --days N       Chỉ phân tích N ngày gần nhất (default: 7)
 *   --output path  Đường dẫn output report (default: .logs/reports/<ts>.md)
 *   --session id   Chỉ phân tích 1 session cụ thể
 */

const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────
const REPO_ROOT = process.cwd();
const LOGS_DIR = path.join(REPO_ROOT, ".logs");
const SPANS_DIR = path.join(LOGS_DIR, "spans");
const METRICS_DIR = path.join(LOGS_DIR, "metrics");
const EVENTS_DIR = path.join(LOGS_DIR, "events");
const SESSIONS_DIR = path.join(LOGS_DIR, "sessions");

// ── CLI Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let maxDays = 7;
let outputPath = null;
let targetSession = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--days" && args[i + 1]) maxDays = parseInt(args[i + 1], 10);
  if (args[i] === "--output" && args[i + 1]) outputPath = args[i + 1];
  if (args[i] === "--session" && args[i + 1]) targetSession = args[i + 1];
}

// ── Helpers ─────────────────────────────────────────────────────────

function readJSONL(dir) {
  const records = [];
  if (!fs.existsSync(dir)) return records;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  for (const file of files) {
    const fileDate = file.replace(".jsonl", "");
    if (fileDate < cutoff.toISOString().slice(0, 10)) continue;

    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line));
      } catch {}
    }
  }
  return records;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatTokens(n) {
  if (!n) return "—";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function barChart(value, max, width = 20) {
  if (max === 0) return "";
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── Data Processing ─────────────────────────────────────────────────

function aggregateSpans(spans) {
  // Per-agent aggregation
  const agents = {}; // agentId → { spans, tokens, duration, tools }
  const interactions = {}; // interaction name → spans

  for (const span of spans) {
    // Per-agent
    const agentId = span.agentId || span.attributes?.agent_id || "main";
    if (!agents[agentId]) {
      agents[agentId] = {
        agentId,
        spanCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalDurationMs: 0,
        toolCalls: 0,
        llmCalls: 0,
        errors: 0,
        models: new Set(),
      };
    }
    const a = agents[agentId];
    a.spanCount++;

    if (span.inputTokens) a.totalInputTokens += span.inputTokens;
    if (span.outputTokens) a.totalOutputTokens += span.outputTokens;
    if (span.attributes?.cache_read_tokens)
      a.totalCacheReadTokens += parseInt(span.attributes.cache_read_tokens, 10);
    if (span.durationMs) a.totalDurationMs += span.durationMs;

    if (span.name === "claude_code.llm_request") a.llmCalls++;
    if (span.name?.startsWith("claude_code.tool")) a.toolCalls++;
    if (span.success === false || span.attributes?.error) a.errors++;
    if (span.model) a.models.add(span.model);
  }

  // Convert Sets
  for (const key of Object.keys(agents)) {
    agents[key].models = Array.from(agents[key].models);
  }

  return agents;
}

function aggregateMetrics(metrics) {
  let totalTokens = 0;
  let totalCost = 0;
  let sessionCount = 0;

  for (const m of metrics) {
    if (m.name === "claude_code.token.usage") {
      const dps = m.data?.dataPoints || [];
      for (const dp of dps) {
        totalTokens += dp.asDouble || dp.asInt || 0;
      }
    }
    if (m.name === "claude_code.cost.usage") {
      const dps = m.data?.dataPoints || [];
      for (const dp of dps) {
        totalCost += dp.asDouble || dp.asInt || 0;
      }
    }
    if (m.name === "claude_code.session.count") {
      const dps = m.data?.dataPoints || [];
      sessionCount += dps.length;
    }
  }

  return { totalTokens, totalCost, sessionCount };
}

function aggregateEvents(events) {
  const toolResults = [];
  const apiErrors = [];
  const apiRefusals = [];
  const skillActivations = [];
  const hookExecutions = [];
  const other = [];

  for (const evt of events) {
    const name = evt.eventName || evt.attributes?.["event.name"] || "";
    if (name.includes("tool_result")) toolResults.push(evt);
    else if (name.includes("api_error")) apiErrors.push(evt);
    else if (name.includes("api_refusal")) apiRefusals.push(evt);
    else if (name.includes("skill_activated")) skillActivations.push(evt);
    else if (name.includes("hook_execution")) hookExecutions.push(evt);
    else other.push(evt);
  }

  return {
    toolResults,
    apiErrors,
    apiRefusals,
    skillActivations,
    hookExecutions,
    other,
  };
}

// ── Report Generation ───────────────────────────────────────────────

function generateReport(agents, metrics, events, spannedDays, dataCounts) {
  const now = new Date();
  const lines = [];

  lines.push(`# SDLC Execution Trace Report`);
  lines.push("");
  lines.push(
    `**Generated:** ${now.toISOString().replace("T", " ").slice(0, 19)}`
  );
  lines.push(`**Time range:** ${spannedDays} days`);
  if (targetSession) lines.push(`**Session:** \`${targetSession}\``);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 1. Executive Summary ──────────────────────────────────────────
  lines.push("## 1. Tổng Quan");
  lines.push("");

  const agentList = Object.values(agents);
  const totalTokens =
    agentList.reduce((s, a) => s + a.totalInputTokens + a.totalOutputTokens, 0) ||
    metrics.totalTokens;
  const totalDuration = agentList.reduce((s, a) => s + a.totalDurationMs, 0);
  const totalLlmCalls = agentList.reduce((s, a) => s + a.llmCalls, 0);
  const totalToolCalls = agentList.reduce((s, a) => s + a.toolCalls, 0);
  const totalErrors =
    agentList.reduce((s, a) => s + a.errors, 0) +
    events.apiErrors.length +
    events.apiRefusals.length;

  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Agents tracked | ${agentList.length} |`);
  lines.push(`| Total LLM calls | ${totalLlmCalls} |`);
  lines.push(`| Total tool calls | ${totalToolCalls} |`);
  lines.push(`| Total tokens | ${formatTokens(totalTokens)} |`);
  lines.push(`| Total execution time | ${formatDuration(totalDuration)} |`);
  lines.push(
    `| Estimated cost | $${metrics.totalCost.toFixed(4)} |`
  );
  lines.push(`| Errors/Refusals | ${totalErrors} |`);
  lines.push(`| Skills activated | ${events.skillActivations.length} |`);
  lines.push("");

  // ── 2. Per-Agent Token Usage ──────────────────────────────────────
  lines.push("## 2. Token Usage Per Agent");
  lines.push("");

  const sortedByTokens = agentList.sort(
    (a, b) =>
      b.totalInputTokens +
      b.totalOutputTokens -
      (a.totalInputTokens + a.totalOutputTokens)
  );

  lines.push(
    "| Agent | LLM Calls | Input Tokens | Output Tokens | Cache Read | Total | % |"
  );
  lines.push(
    "|-------|-----------|-------------|---------------|------------|-------|---|"
  );

  for (const a of sortedByTokens) {
    const total = a.totalInputTokens + a.totalOutputTokens;
    const pct =
      totalTokens > 0 ? ((total / totalTokens) * 100).toFixed(1) : "0.0";
    const name =
      a.agentId.length > 30 ? a.agentId.slice(0, 27) + "..." : a.agentId;
    lines.push(
      `| \`${name}\` | ${a.llmCalls} | ${formatTokens(a.totalInputTokens)} | ` +
        `${formatTokens(a.totalOutputTokens)} | ${formatTokens(a.totalCacheReadTokens)} | ` +
        `${formatTokens(total)} | ${pct}% |`
    );
  }
  lines.push("");

  // ── 3. Timeline ───────────────────────────────────────────────────
  lines.push("## 3. Execution Duration Per Agent");
  lines.push("");

  const sortedByDuration = [...agentList].sort(
    (a, b) => b.totalDurationMs - a.totalDurationMs
  );
  const maxDuration = sortedByDuration[0]?.totalDurationMs || 1;

  lines.push("```");
  for (const a of sortedByDuration) {
    const bar = barChart(a.totalDurationMs, maxDuration);
    const name = (a.agentId || "unknown").padEnd(25);
    lines.push(`${name} ${bar} ${formatDuration(a.totalDurationMs)}`);
  }
  lines.push("```");
  lines.push("");

  // ── 4. Bottleneck Detection ───────────────────────────────────────
  lines.push("## 4. Bottleneck Analysis");
  lines.push("");

  const avgDuration =
    sortedByDuration.length > 0
      ? sortedByDuration.reduce((s, a) => s + a.totalDurationMs, 0) /
        sortedByDuration.length
      : 0;

  if (sortedByDuration.length > 0) {
    const slowest = sortedByDuration[0];

    lines.push(
      `**🔴 Slowest agent:** \`${slowest.agentId}\` — ${formatDuration(slowest.totalDurationMs)}`
    );
    lines.push(
      `   (${((slowest.totalDurationMs / avgDuration) * 100).toFixed(0)}% of average)`
    );
    lines.push("");

    // Agents that take >2x average
    const slowAgents = sortedByDuration.filter(
      (a) => a.totalDurationMs > avgDuration * 2
    );
    if (slowAgents.length > 0) {
      lines.push("**Agents >2x average duration:**");
      lines.push("");
      for (const a of slowAgents) {
        lines.push(
          `- \`${a.agentId}\` — ${formatDuration(a.totalDurationMs)} (${a.llmCalls} LLM calls, ${a.toolCalls} tool calls)`
        );
      }
      lines.push("");
    }
  }

  // Token efficiency
  const sortedByTokenPerCall = [...agentList]
    .filter((a) => a.llmCalls > 0)
    .sort(
      (a, b) =>
        (b.totalInputTokens + b.totalOutputTokens) / b.llmCalls -
        (a.totalInputTokens + a.totalOutputTokens) / a.llmCalls
    );

  if (sortedByTokenPerCall.length > 0) {
    lines.push(
      "**🔴 Highest tokens/LLM call (potential prompt bloat):**"
    );
    lines.push("");
    for (const a of sortedByTokenPerCall.slice(0, 3)) {
      const avg = Math.round(
        (a.totalInputTokens + a.totalOutputTokens) / a.llmCalls
      );
      lines.push(
        `- \`${a.agentId}\` — ${formatTokens(avg)} tokens/call`
      );
    }
    lines.push("");
  }

  // ── 5. Error & Failure Tracking ───────────────────────────────────
  lines.push("## 5. Errors & Failures");
  lines.push("");

  const totalEventErrors =
    events.apiErrors.length + events.apiRefusals.length + agentList.reduce((s, a) => s + a.errors, 0);

  if (totalEventErrors === 0) {
    lines.push("✅ **No errors detected in the analyzed period.**");
    lines.push("");
  } else {
    lines.push("| Type | Count | Details |");
    lines.push("|------|-------|---------|");

    if (events.apiErrors.length > 0) {
      const byModel = {};
      for (const e of events.apiErrors) {
        const m = e.attributes?.model || "unknown";
        byModel[m] = (byModel[m] || 0) + 1;
      }
      const detail = Object.entries(byModel)
        .map(([m, c]) => `${m}: ${c}`)
        .join(", ");
      lines.push(`| API Errors | ${events.apiErrors.length} | ${detail} |`);
    }

    if (events.apiRefusals.length > 0) {
      lines.push(
        `| API Refusals | ${events.apiRefusals.length} | Safety/refusal responses |`
      );
    }

    const agentErrors = agentList.filter((a) => a.errors > 0);
    for (const a of agentErrors) {
      lines.push(
        `| Agent \`${a.agentId}\` errors | ${a.errors} | Span-level failures |`
      );
    }

    lines.push("");
  }

  // ── 6. Model Usage ────────────────────────────────────────────────
  lines.push("## 6. Model Usage");
  lines.push("");

  const modelUsage = {};
  for (const a of agentList) {
    for (const m of a.models) {
      if (!modelUsage[m]) modelUsage[m] = { calls: 0, agents: new Set() };
      modelUsage[m].calls += a.llmCalls;
      modelUsage[m].agents.add(a.agentId);
    }
  }

  lines.push("| Model | LLM Calls | Agents Using |");
  lines.push("|-------|-----------|-------------|");
  for (const [model, data] of Object.entries(modelUsage).sort(
    (a, b) => b[1].calls - a[1].calls
  )) {
    lines.push(
      `| \`${model}\` | ${data.calls} | ${data.agents.size} |`
    );
  }
  lines.push("");

  // ── 7. Pipeline Health ────────────────────────────────────────────
  lines.push("## 7. Pipeline Health Overview");
  lines.push("");

  const successRate =
    totalLlmCalls > 0
      ? (
          ((totalLlmCalls - totalEventErrors) / totalLlmCalls) *
          100
        ).toFixed(1)
      : "100.0";

  lines.push("| Indicator | Value | Status |");
  lines.push("|-----------|-------|--------|");
  lines.push(
    `| LLM success rate | ${successRate}% | ${
      parseFloat(successRate) >= 95 ? "✅" : parseFloat(successRate) >= 80 ? "⚠️" : "🔴"
    } |`
  );

  const avgTokensPerCall =
    totalLlmCalls > 0
      ? Math.round(totalTokens / totalLlmCalls)
      : 0;
  lines.push(
    `| Avg tokens/LLM call | ${formatTokens(avgTokensPerCall)} | — |`
  );

  const errorRate =
    totalLlmCalls > 0
      ? ((totalEventErrors / totalLlmCalls) * 100).toFixed(1)
      : "0.0";
  lines.push(
    `| Error rate | ${errorRate}% | ${
      parseFloat(errorRate) <= 2 ? "✅" : parseFloat(errorRate) <= 10 ? "⚠️" : "🔴"
    } |`
  );

  lines.push(
    `| Unique agents | ${agentList.length} | — |`
  );
  lines.push(
    `| Tools called | ${totalToolCalls} | — |`
  );
  lines.push(
    `| Skills activated | ${events.skillActivations.length} | — |`
  );
  lines.push("");

  // ── 8. Recommendations ────────────────────────────────────────────
  lines.push("## 8. Recommendations");
  lines.push("");

  const recs = [];

  // Check for agents with high token usage
  if (sortedByTokens.length > 0 && totalTokens > 0) {
    const topAgent = sortedByTokens[0];
    const topPct =
      ((topAgent.totalInputTokens + topAgent.totalOutputTokens) / totalTokens) *
      100;
    if (topPct > 50) {
      recs.push(
        `- **High token concentration:** \`${topAgent.agentId}\` uses ${topPct.toFixed(0)}% of all tokens. Consider optimizing its system prompt or reducing reference material.`
      );
    }
  }

  // Check for slow agents
  if (sortedByDuration.length > 0 && avgDuration > 0) {
    const avgDur =
      sortedByDuration.reduce((s, a) => s + a.totalDurationMs, 0) /
      sortedByDuration.length;
    const slow = sortedByDuration.filter((a) => a.totalDurationMs > avgDur * 3);
    for (const a of slow) {
      recs.push(
        `- **Slow agent:** \`${a.agentId}\` takes ${formatDuration(a.totalDurationMs)} (${Math.round(a.totalDurationMs / avgDur)}x avg). Check if it's doing redundant work or loading too much context.`
      );
    }
  }

  // Check for errors
  if (events.apiErrors.length > 0) {
    recs.push(
      `- **API errors detected** (${events.apiErrors.length} occurrences). Review error patterns — consider retry logic or model fallback configuration.`
    );
  }

  // Check for refusals
  if (events.apiRefusals.length > 0) {
    recs.push(
      `- **API refusals detected** (${events.apiRefusals.length} occurrences). These may indicate safety filter triggers — review the prompts that caused refusals.`
    );
  }

  // Cache utilization
  const totalCacheRead = agentList.reduce(
    (s, a) => s + a.totalCacheReadTokens,
    0
  );
  if (totalCacheRead === 0 && totalTokens > 100000) {
    recs.push(
      "- **No cache hits detected.** Consider enabling prompt caching to reduce cost and latency."
    );
  }

  if (recs.length === 0) {
    recs.push("- ✅ **No issues detected.** Pipeline is running smoothly.");
  }

  lines.push(recs.join("\n"));
  lines.push("");

  // ── 9. Data Sources ───────────────────────────────────────────────
  lines.push("---");
  lines.push("");
  lines.push("## Data Sources");
  lines.push("");
  lines.push(`- Spans: \`.logs/spans/\` (${dataCounts.spans} records analyzed)`);
  lines.push(
    `- Metrics: \`.logs/metrics/\` (${dataCounts.metrics} records analyzed)`
  );
  lines.push(
    `- Events: \`.logs/events/\` (${dataCounts.events} records analyzed)`
  );
  lines.push(
    `- Generated by: \`sdlc-monitor/scripts/analyze-traces.js\``
  );
  lines.push("");

  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  // Read data
  const spans = readJSONL(SPANS_DIR);
  const metricsData = readJSONL(METRICS_DIR);
  const eventsData = readJSONL(EVENTS_DIR);

  // If no data at all
  if (spans.length === 0 && metricsData.length === 0 && eventsData.length === 0) {
    console.log("No telemetry data found in .logs/");
    console.log(
      "Run Claude Code with telemetry enabled to collect data first."
    );
    console.log("  ./scripts/run-telemetry.sh");
    process.exit(1);
  }

  // Aggregate
  const agents = aggregateSpans(spans);
  const metrics = aggregateMetrics(metricsData);
  const events = aggregateEvents(eventsData);

  // Generate report
  const report = generateReport(agents, metrics, events, maxDays, {
    spans: spans.length,
    metrics: metricsData.length,
    events: eventsData.length,
  });

  // Write output
  if (!outputPath) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const reportsDir = path.join(LOGS_DIR, "reports");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    outputPath = path.join(reportsDir, `${ts}.md`);
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outputPath, report);

  // Summary to stdout
  const totalTokens =
    Object.values(agents).reduce(
      (s, a) => s + a.totalInputTokens + a.totalOutputTokens,
      0
    ) || metrics.totalTokens;
  const totalLlmCalls = Object.values(agents).reduce(
    (s, a) => s + a.llmCalls,
    0
  );

  console.log(`✅ Report generated: ${outputPath}`);
  console.log(`   Agents: ${Object.keys(agents).length}`);
  console.log(`   LLM calls: ${totalLlmCalls}`);
  console.log(`   Total tokens: ${formatTokens(totalTokens)}`);
  console.log(
    `   Est. cost: $${metrics.totalCost.toFixed(4)}`
  );
  console.log(
    `   Errors: ${events.apiErrors.length + events.apiRefusals.length}`
  );
}

main();
