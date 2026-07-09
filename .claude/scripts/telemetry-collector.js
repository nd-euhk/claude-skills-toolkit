#!/usr/bin/env node

/**
 * Telemetry Collector — OTLP HTTP/JSON Receiver
 *
 * Nhận traces, metrics, events từ Claude Code OpenTelemetry export,
 * transform thành structured files trong .work/traces/.
 *
 * Endpoints:
 *   POST /v1/traces   — OTLP traces (spans)
 *   POST /v1/metrics   — OTLP metrics
 *   POST /v1/logs      — OTLP logs/events
 *   GET  /health       — readiness probe
 *
 * Usage:
 *   node scripts/telemetry-collector.js [port]
 *   Default port: 4318
 */

const http = require("http");
const path = require("path");
const fs = require("fs");

// ── Config ──────────────────────────────────────────────────────────
const PORT = parseInt(process.argv[2], 10) || 4318;
const LOGS_DIR = path.join(process.cwd(), ".logs");
const PID_FILE = path.join(process.cwd(), ".logs", "telemetry-server.pid");

// ── Helpers ─────────────────────────────────────────────────────────

/** Parse OTLP attribute array → flat {key: value} object */
function parseAttributes(attrs) {
  if (!attrs || !Array.isArray(attrs)) return {};
  const out = {};
  for (const a of attrs) {
    if (!a.key) continue;
    const v = a.value || {};
    out[a.key] =
      v.stringValue ??
      v.intValue ??
      v.doubleValue ??
      v.boolValue ??
      v.arrayValue ??
      v.kvlistValue ??
      null;
  }
  return out;
}

/** Convert OTLP nanosecond timestamp to ISO string */
function nanosToISO(ns) {
  if (!ns) return null;
  const ms = Math.floor(Number(BigInt(ns) / 1_000_000n));
  return new Date(ms).toISOString();
}

/** Flatten a span into our structured format */
function flattenSpan(span, resourceAttrs, scopeName) {
  const attrs = parseAttributes(span.attributes);
  const start = nanosToISO(span.startTimeUnixNano);
  const end = nanosToISO(span.endTimeUnixNano);
  const durationMs =
    start && end
      ? new Date(end).getTime() - new Date(start).getTime()
      : null;

  const events = (span.events || []).map((e) => ({
    name: e.name,
    time: nanosToISO(e.timeUnixNano),
    attributes: parseAttributes(e.attributes),
  }));

  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId || null,
    name: span.name,
    kind: span.kind,
    scope: scopeName,
    startTime: start,
    endTime: end,
    durationMs,
    attributes: attrs,
    events,
    resource: resourceAttrs,
    // Extract key fields from known attribute names
    agentId: attrs.agent_id || null,
    parentAgentId: attrs.parent_agent_id || null,
    workflowRunId: attrs["workflow.run_id"] || null,
    workflowName: attrs["workflow.name"] || null,
    toolName: attrs.tool_name || null,
    model: attrs.model || null,
    inputTokens: attrs.input_tokens ? parseInt(attrs.input_tokens, 10) : null,
    outputTokens: attrs.output_tokens ? parseInt(attrs.output_tokens, 10) : null,
    success: attrs.success === "true" ? true : attrs.success === "false" ? false : null,
  };
}

/** Write a line to a JSONL file, creating dirs as needed */
function appendJSONL(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n");
}

/** Save a structured trace file for one interaction */
function saveInteractionTrace(sessionId, seq, spans, metrics, logs) {
  const dir = path.join(LOGS_DIR, "sessions", sessionId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `interaction-${String(seq).padStart(3, "0")}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        sessionId,
        interactionSeq: seq,
        capturedAt: new Date().toISOString(),
        spans,
        metrics: metrics || [],
        events: logs || [],
      },
      null,
      2
    )
  );
  return filePath;
}

// ── OTLP Handlers ──────────────────────────────────────────────────

function handleTraces(body) {
  const results = [];
  const resourceSpans = body.resourceSpans || [];

  for (const rs of resourceSpans) {
    const resourceAttrs = parseAttributes(rs.resource?.attributes);

    for (const ss of rs.scopeSpans || []) {
      const scopeName = ss.scope?.name || "unknown";

      for (const span of ss.spans || []) {
        const flat = flattenSpan(span, resourceAttrs, scopeName);
        results.push(flat);

        // Write individual span to JSONL for streaming analysis
        appendJSONL(
          path.join(LOGS_DIR, "spans", `${new Date().toISOString().slice(0, 10)}.jsonl`),
          flat
        );
      }
    }
  }

  // Extract session info from resource attributes
  const sid =
    resourceSpans[0] && resourceSpans[0].resource
      ? parseAttributes(resourceSpans[0].resource.attributes)["session.id"]
      : null;

  return { count: results.length, sessionId: sid, spans: results };
}

function handleMetrics(body) {
  let count = 0;
  const resourceMetrics = body.resourceMetrics || [];

  for (const rm of resourceMetrics) {
    const resourceAttrs = parseAttributes(rm.resource?.attributes);

    for (const sm of rm.scopeMetrics || []) {
      for (const metric of sm.metrics || []) {
        count++;

        const record = {
          name: metric.name,
          description: metric.description || "",
          unit: metric.unit || "",
          resource: resourceAttrs,
          data: metric.histogram || metric.sum || metric.gauge || metric.summary || null,
          capturedAt: new Date().toISOString(),
        };

        appendJSONL(
          path.join(LOGS_DIR, "metrics", `${new Date().toISOString().slice(0, 10)}.jsonl`),
          record
        );
      }
    }
  }

  return { count };
}

function handleLogs(body) {
  let count = 0;
  const resourceLogs = body.resourceLogs || [];

  for (const rl of resourceLogs) {
    const resourceAttrs = parseAttributes(rl.resource?.attributes);

    for (const sl of rl.scopeLogs || []) {
      for (const record of sl.logRecords || []) {
        count++;

        const evt = {
          time: nanosToISO(record.timeUnixNano),
          observedTime: nanosToISO(record.observedTimeUnixNano),
          severityText: record.severityText || "",
          body: typeof record.body === "string" ? record.body : record.body?.stringValue || "",
          attributes: parseAttributes(record.attributes),
          resource: resourceAttrs,
        };

        // Map known event names from attributes
        const eventName =
          evt.attributes["event.name"] || evt.attributes.name || evt.body;

        appendJSONL(
          path.join(LOGS_DIR, "events", `${new Date().toISOString().slice(0, 10)}.jsonl`),
          { ...evt, eventName }
        );
      }
    }
  }

  return { count };
}

// ── HTTP Server ────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch (e) {
        reject(new Error(`Invalid JSON: ${e.message}`));
      }
    });
    req.on("error", reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

const ROUTES = {
  "/v1/traces": handleTraces,
  "/v1/metrics": handleMetrics,
  "/v1/logs": handleLogs,
};

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === "/health" && req.method === "GET") {
    const uptime = Math.floor(process.uptime());
    return jsonResponse(res, 200, {
      status: "ok",
      uptime,
      tracesDir: LOGS_DIR,
      pid: process.pid,
    });
  }

  // OTLP endpoints
  const handler = ROUTES[url.pathname];
  if (handler && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const result = handler(body);
      if (process.env.DEBUG_TELEMETRY) {
        const prefix = url.pathname.split("/").pop();
        process.stderr.write(
          `[telemetry] ${prefix}: ${result.count || 0} records\n`
        );
      }
      return jsonResponse(res, 200, {
        partialSuccess: {},
        ...result,
      });
    } catch (err) {
      process.stderr.write(`[telemetry] ERROR ${url.pathname}: ${err.message}\n`);
      return jsonResponse(res, 400, { error: err.message });
    }
  }

  // 404
  jsonResponse(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
});

// ── Startup ────────────────────────────────────────────────────────

// Ensure trace directories exist
for (const sub of ["spans", "metrics", "events", "sessions"]) {
  fs.mkdirSync(path.join(LOGS_DIR, sub), { recursive: true });
}

// Write PID file
fs.writeFileSync(PID_FILE, String(process.pid));

server.listen(PORT, () => {
  process.stderr.write(`[telemetry] Collector listening on http://localhost:${PORT}\n`);
  process.stderr.write(`[telemetry] Traces dir: ${LOGS_DIR}\n`);
  process.stderr.write(`[telemetry] PID: ${process.pid}\n`);
});

// Graceful shutdown
function shutdown() {
  process.stderr.write(`[telemetry] Shutting down...\n`);
  server.close(() => {
    try { fs.unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  });
  // Force exit after 3s
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
