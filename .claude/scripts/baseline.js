#!/usr/bin/env node
/**
 * baseline.js — SDLC Harness: Test Suite Baseline Capture & Comparison.
 *
 * Node.js implementation of the baseline harness. Same CLI and output format
 * as baseline.py. Uses only Node.js built-in modules — zero dependencies.
 *
 * Modes:
 *   capture   Run tests + parse output → standardized baseline JSON
 *   parse     Parse existing test output → baseline JSON (tests already run)
 *   list-tcs  Print TC index (1→N) from a baseline file (for RED agents)
 *   compare   Baseline vs current → INTERFERENCE-FULL detection
 *
 * Supported frameworks:
 *   junit-xml, jest-json, vitest-json, pytest-json, go-json, rust-text
 *
 * Usage:
 *   node baseline.js parse --framework vitest-json --input /tmp/raw.json \
 *       --fr-id FR-001 --layer be --service user-service
 *
 * Output: Standardized baseline JSON (schema_version 1.0)
 *   See baseline.py for the complete schema.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Helpers ─────────────────────────────────────────────────────────────

function isoNow() {
    return new Date().toISOString();
}

function todayStr() {
    const d = new Date();
    return d.getFullYear()
        + String(d.getMonth() + 1).padStart(2, '0')
        + String(d.getDate()).padStart(2, '0');
}

function fail(msg) {
    console.error(`ERROR: ${msg}`);
    process.exit(1);
}

function warn(msg) {
    console.error(`WARNING: ${msg}`);
}

// ── Framework Parsers ───────────────────────────────────────────────────

function parseJunitXml(dir) {
    const xmlDir = path.resolve(dir);
    if (!fs.existsSync(xmlDir)) fail(`JUnit XML directory not found: ${xmlDir}`);

    const files = fs.readdirSync(xmlDir)
        .filter(f => f.startsWith('TEST-') && f.endsWith('.xml'))
        .sort();

    if (files.length === 0) fail(`No TEST-*.xml files found in ${xmlDir}`);

    const tests = [];
    for (const f of files) {
        const content = fs.readFileSync(path.join(xmlDir, f), 'utf-8');
        // Lightweight XML parse without dependencies — regex extraction
        const className = (content.match(/<testsuite[^>]*\sname="([^"]*)"/) || [])[1]
            || f.replace(/^TEST-/, '').replace(/\.xml$/, '');
        const pkgName = className.includes('.')
            ? className.split('.').slice(0, -1).join('.') : '';
        const shortClass = className.includes('.')
            ? className.split('.').pop() : className;

        // Extract testcase elements
        const tcRegex = /<testcase[^>]*\sname="([^"]*)"[^>]*\stime="([^"]*)"[^>]*>/g;
        let match;
        while ((match = tcRegex.exec(content)) !== null) {
            const method = match[1];
            const duration = parseFloat(match[2]) * 1000 || 0;
            // Look ahead for failure/error/skipped within this testcase
            const afterIdx = match.index + match[0].length;
            const endIdx = content.indexOf('</testcase>', afterIdx);
            const inner = content.slice(afterIdx, endIdx > 0 ? endIdx : afterIdx + 500);

            let status = 'pass';
            let error = '';
            if (inner.includes('<failure') || inner.includes('<error')) {
                status = 'fail';
                const msgMatch = inner.match(/message="([^"]*)"/);
                error = msgMatch ? msgMatch[1] : '';
            } else if (inner.includes('<skipped')) {
                status = 'skip';
                const msgMatch = inner.match(/message="([^"]*)"/);
                error = msgMatch ? msgMatch[1] : '';
            }

            tests.push({
                file: className.replace(/\./g, '/') + '.java',
                method,
                class: shortClass,
                package: pkgName,
                status,
                duration_ms: Math.round(duration * 10) / 10,
                error,
            });
        }
    }
    return tests;
}

function parseJsonFramework(inputFile, type) {
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    const tests = [];

    const statusMap = {
        jest: { passed: 'pass', failed: 'fail', skipped: 'skip', pending: 'skip', todo: 'skip' },
        vitest: { passed: 'pass', failed: 'fail', skipped: 'skip', pending: 'skip', todo: 'skip' },
        pytest: { passed: 'pass', failed: 'fail', skipped: 'skip', xfailed: 'pass', xpassed: 'fail', error: 'fail' },
    };
    const map = statusMap[type] || statusMap.vitest;

    // jest/vitest format
    const suites = data.testResults || data.suites || [];
    for (const suite of suites) {
        const filePath = suite.name || suite.file || '';
        const results = suite.assertionResults || suite.tests || suite.testResults || [];
        for (const tc of results) {
            const rawStatus = tc.status || 'unknown';
            const method = tc.fullName || tc.title || tc.name || '';
            const ancestors = tc.ancestorTitles || [];
            const errorMsg = (tc.failureMessages && tc.failureMessages[0])
                || tc.message || tc.failure || '';

            tests.push({
                file: filePath,
                method,
                class: ancestors[ancestors.length - 1] || '',
                status: map[rawStatus] || rawStatus,
                duration_ms: tc.duration || 0,
                error: errorMsg,
            });
        }
    }

    // pytest format
    if (tests.length === 0 && data.tests) {
        for (const tc of data.tests) {
            const nodeid = tc.nodeid || '';
            const parts = nodeid.split('::');
            const file = parts[0] || '';
            const method = parts.slice(1).join('::') || nodeid;
            const cls = parts.length > 2 ? parts[1] : '';
            const outcome = tc.outcome || 'unknown';

            tests.push({
                file,
                method,
                class: cls,
                status: map[outcome] || outcome,
                duration_ms: Math.round((tc.duration || 0) * 1000 * 10) / 10,
                error: (tc.call && tc.call.longrepr) || '',
            });
        }
    }

    return tests;
}

function parseGoJson(inputFile) {
    const content = fs.readFileSync(inputFile, 'utf-8');
    const tests = [];
    const lines = content.trim().split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;
        let evt;
        try { evt = JSON.parse(line); } catch { continue; }
        if (!evt.Test) continue;

        if (evt.Action === 'pass') {
            tests.push({
                file: evt.Package || '',
                method: evt.Test,
                class: (evt.Package || '').split('/').pop(),
                status: 'pass',
                duration_ms: Math.round((evt.Elapsed || 0) * 1000 * 10) / 10,
                error: '',
            });
        } else if (evt.Action === 'fail') {
            tests.push({
                file: evt.Package || '',
                method: evt.Test,
                class: (evt.Package || '').split('/').pop(),
                status: 'fail',
                duration_ms: Math.round((evt.Elapsed || 0) * 1000 * 10) / 10,
                error: evt.Output || '',
            });
        } else if (evt.Action === 'skip') {
            tests.push({
                file: evt.Package || '',
                method: evt.Test,
                class: (evt.Package || '').split('/').pop(),
                status: 'skip',
                duration_ms: 0,
                error: evt.Output || '',
            });
        }
    }
    return tests;
}

function parseRustText(inputFile) {
    const content = fs.readFileSync(inputFile, 'utf-8');
    const tests = [];

    // Try JSON-lines format first
    if (content.trim().startsWith('{')) {
        const lines = content.trim().split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            let evt;
            try { evt = JSON.parse(line); } catch { continue; }
            if (evt.type === 'test' && (evt.event === 'ok' || evt.event === 'failed')) {
                const name = evt.name || '';
                const parts = name.split('::');
                tests.push({
                    file: parts.length > 1 ? parts[0] : '',
                    method: name,
                    class: '',
                    status: evt.event === 'ok' ? 'pass' : 'fail',
                    duration_ms: Math.round((evt.exec_time || 0) * 1000 * 10) / 10,
                    error: evt.stdout || '',
                });
            }
        }
    } else {
        // Verbose text fallback
        const re = /test\s+(?<method>\S+)\s+\.\.\.\s+(?<status>ok|FAILED|ignored)/g;
        const statusMap = { ok: 'pass', FAILED: 'fail', ignored: 'skip' };
        let match;
        while ((match = re.exec(content)) !== null) {
            tests.push({
                file: '',
                method: match.groups.method,
                class: '',
                status: statusMap[match.groups.status] || 'unknown',
                duration_ms: 0,
                error: '',
            });
        }
    }
    return tests;
}

// ── Parser registry ─────────────────────────────────────────────────────

const PARSERS = {
    'junit-xml':    (opts) => parseJunitXml(opts.testOutputDir),
    'jest-json':    (opts) => parseJsonFramework(opts.input, 'jest'),
    'vitest-json':  (opts) => parseJsonFramework(opts.input, 'vitest'),
    'pytest-json':  (opts) => parseJsonFramework(opts.input, 'pytest'),
    'go-json':      (opts) => parseGoJson(opts.input),
    'rust-text':    (opts) => parseRustText(opts.input),
};

// ── Baseline Builder ────────────────────────────────────────────────────

function buildBaseline(tests, opts) {
    // Sort by file then method for deterministic ordering
    tests.sort((a, b) => {
        const fa = a.file || '', fb = b.file || '';
        if (fa !== fb) return fa.localeCompare(fb);
        return (a.method || '').localeCompare(b.method || '');
    });

    // Assign sequential IDs
    tests.forEach((t, i) => { t.id = i + 1; });

    const summary = {
        total: tests.length,
        passed: tests.filter(t => t.status === 'pass').length,
        failed: tests.filter(t => t.status === 'fail').length,
        skipped: tests.filter(t => t.status === 'skip').length,
    };

    const tcIndex = {};
    for (const t of tests) {
        tcIndex[String(t.id)] = `${t.method} (${t.status})`;
    }

    const byFile = {};
    for (const t of tests) {
        const fname = t.file || '(unknown)';
        if (!byFile[fname]) byFile[fname] = [];
        byFile[fname].push(t.id);
    }

    const preExistingFailures = tests
        .filter(t => t.status === 'fail')
        .map(t => ({
            id: t.id,
            method: t.method,
            file: t.file || '',
            error: t.error || '',
        }));

    const baseline = {
        schema_version: '1.0',
        feature: opts.frId,
        layer: opts.layer,
        captured_at: isoNow(),
        framework: opts.framework,
        test_command: opts.testCommand || '',
        summary,
        tests,
        tcIndex: tcIndex,
        preExistingFailures: preExistingFailures,
        byFile: byFile,
    };

    if (opts.service) baseline.service = opts.service;
    if (opts.app) baseline.app = opts.app;

    return baseline;
}

function writeBaseline(baseline, outputPath) {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2), 'utf-8');
    return outputPath;
}

function defaultOutputPath(frId, layer) {
    return `.work/baselines/${todayStr()}-${frId}-${layer.toUpperCase()}.json`;
}

// ── Output Helpers ──────────────────────────────────────────────────────

const ICONS = { pass: '✅', fail: '❌', skip: '⏭️' };

function printTcIndex(baseline, filterFile, filterStatus) {
    console.log(`Feature: ${baseline.feature}  Layer: ${baseline.layer}  `
        + `Framework: ${baseline.framework || 'N/A'}`);
    console.log(`Captured: ${baseline.captured_at}`);
    const s = baseline.summary;
    console.log(`Summary: ${s.total} total, ${s.passed} passed, `
        + `${s.failed} failed, ${s.skipped} skipped`);
    console.log();

    const pre = baseline.preExistingFailures || [];
    if (pre.length > 0 && !filterFile && !filterStatus) {
        console.log(`⚠️  PRE-EXISTING FAILURES (${pre.length}):`);
        for (const f of pre) {
            console.log(`  TC-${f.id}: ${f.method} (${f.file})`);
            if (f.error) console.log(`       ${f.error.slice(0, 120)}`);
        }
        console.log();
    }

    const byFile = baseline.byFile || {};
    let shownCount = 0;

    for (const [fname, tcIds] of Object.entries(byFile)) {
        const fileTests = tcIds
            .map(id => baseline.tests.find(t => t.id === id))
            .filter(Boolean);

        let filtered = fileTests;
        if (filterFile && !fname.includes(filterFile)) continue;
        if (filterStatus) {
            filtered = fileTests.filter(t => t.status === filterStatus);
            if (filtered.length === 0) continue;
        }

        console.log(`📄 ${fname} (${fileTests.length} tests)`);
        for (const tc of (filterFile || filterStatus ? filtered : fileTests)) {
            const icon = ICONS[tc.status] || '❓';
            const dur = tc.duration_ms ? ` (${tc.duration_ms}ms)` : '';
            console.log(`  ${icon} TC-${tc.id}: ${tc.method}${dur}`);
        }
        console.log();
        shownCount += filtered.length;
    }

    if (filterFile || filterStatus) {
        console.log(`── Filtered: ${shownCount} tests ──`);
        const filtered = baseline.tests.filter(t => {
            if (filterFile && !(t.file || '').includes(filterFile)) return false;
            if (filterStatus && t.status !== filterStatus) return false;
            return true;
        });
        for (const tc of filtered) {
            const icon = ICONS[tc.status] || '❓';
            console.log(`  ${icon} TC-${tc.id}: ${tc.method} (${tc.file || '?'})`);
        }
    }
}

function printJsonTcList(baseline, filterFile, filterStatus) {
    let tests = baseline.tests;
    if (filterFile) tests = tests.filter(t => (t.file || '').includes(filterFile));
    if (filterStatus) tests = tests.filter(t => t.status === filterStatus);
    console.log(JSON.stringify(tests.map(t => t.id)));
}

function printInterferenceReport(baseline, currentTests, culprit) {
    const baselineMap = new Map();
    for (const t of baseline.tests) {
        baselineMap.set(`${t.file || ''}::${t.method}`, t);
    }

    const currentMap = new Map();
    for (const t of currentTests) {
        currentMap.set(`${t.file || ''}::${t.method}`, t);
    }

    const interference = [];
    for (const [key, blTc] of baselineMap) {
        if (blTc.status !== 'pass') continue;
        const curTc = currentMap.get(key);
        if (!curTc) {
            interference.push({
                baseline_test: blTc,
                current_status: 'missing',
                error: 'Test no longer exists in suite',
            });
        } else if (curTc.status === 'fail') {
            interference.push({
                baseline_test: blTc,
                current_status: 'fail',
                error: curTc.error || '',
            });
        }
    }

    if (interference.length === 0) {
        console.log('✅ INTERFERENCE-FULL: Clean — no broken tests.');
        return 0;
    }

    console.log(`❌ INTERFERENCE-FULL: ${interference.length} tests broken!\n`);
    const hdr = 'Broken Test'.padEnd(45) + 'File'.padEnd(30) + 'Baseline'.padEnd(8) + 'Now';
    console.log(hdr);
    console.log('-'.repeat(95));

    for (const item of interference) {
        const bl = item.baseline_test;
        const method = (bl.method || '').slice(0, 42).padEnd(45);
        const fname = (bl.file || '?').slice(0, 28).padEnd(30);
        console.log(`${method} ${fname} pass     ${item.current_status}`);
    }

    if (culprit) {
        console.log(`\n⚠️  Likely culprit: ${culprit}`);
        console.log('   Check which TC modified shared files or fixtures.');
    }

    console.log(`\n${interference.length} interference hits total.`);
    return interference.length;
}

function printJsonInterference(baseline, currentTests) {
    const baselineMap = new Map();
    for (const t of baseline.tests) {
        baselineMap.set(`${t.file || ''}::${t.method}`, t);
    }

    const interference = [];
    for (const ct of currentTests) {
        const key = `${ct.file || ''}::${ct.method}`;
        const blTc = baselineMap.get(key);
        if (blTc && blTc.status === 'pass' && ct.status === 'fail') {
            interference.push({
                test: ct.method,
                file: ct.file || '',
                baseline_status: 'pass',
                current_status: 'fail',
                error: ct.error || '',
            });
        }
    }
    console.log(JSON.stringify(interference, null, 2));
}

// ── CLI ─────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printHelp();
        process.exit(0);
    }

    const mode = args[0];
    const opts = {};

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--framework':    opts.framework = args[++i]; break;
            case '--test-output-dir': opts.testOutputDir = args[++i]; break;
            case '--input':        opts.input = args[++i]; break;
            case '--fr-id':        opts.frId = args[++i]; break;
            case '--layer':        opts.layer = args[++i]; break;
            case '--service':      opts.service = args[++i]; break;
            case '--app':          opts.app = args[++i]; break;
            case '--test-command': opts.testCommand = args[++i]; break;
            case '--output':       opts.output = args[++i]; break;
            case '--baseline':     opts.baseline = args[++i]; break;
            case '--current':      opts.current = args[++i]; break;
            case '--culprit':      opts.culprit = args[++i]; break;
            case '--file':         opts.filterFile = args[++i]; break;
            case '--status':       opts.filterStatus = args[++i]; break;
            case '--json':         opts.jsonOutput = true; break;
            case '--dry-run':      opts.dryRun = true; break;
            default: break;
        }
    }

    return { mode, opts };
}

function printHelp() {
    console.log(`baseline.js — SDLC Harness: Test Suite Baseline Capture & Comparison

Usage:
  node baseline.js capture --framework <f> --input <file> --fr-id <id> --layer <be|fe> [...]
  node baseline.js parse   --framework <f> --input <file> --fr-id <id> --layer <be|fe> [...]
  node baseline.js list-tcs --baseline <file> [--file <filter>] [--status <s>] [--json]
  node baseline.js compare --baseline <file> --current <file> --framework <f> [--culprit <s>] [--json]

Frameworks: junit-xml, jest-json, vitest-json, pytest-json, go-json, rust-text`);
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
    const { mode, opts } = parseArgs();

    if (mode === 'capture' || mode === 'parse') {
        // Validate
        if (!opts.framework || !PARSERS[opts.framework]) {
            fail(`Invalid or missing --framework. Choices: ${Object.keys(PARSERS).join(', ')}`);
        }
        if (!opts.frId) fail('--fr-id required');
        if (!opts.layer || !['be', 'fe'].includes(opts.layer)) fail('--layer must be be|fe');

        if (opts.framework === 'junit-xml') {
            if (!opts.testOutputDir) fail('--test-output-dir required for junit-xml');
        } else {
            if (!opts.input) fail(`--input required for ${opts.framework}`);
            if (!fs.existsSync(opts.input)) fail(`Input file not found: ${opts.input}`);
        }

        const tests = PARSERS[opts.framework](opts);
        const baseline = buildBaseline(tests, opts);
        const outputPath = opts.output || defaultOutputPath(opts.frId, opts.layer);

        if (opts.dryRun) {
            console.log(JSON.stringify(baseline, null, 2));
        } else {
            const written = writeBaseline(baseline, outputPath);
            console.log(`✅ Baseline captured: ${written}`);
            const s = baseline.summary;
            console.log(`   ${s.total} tests — ${s.passed} pass, ${s.failed} fail, ${s.skipped} skip`);
            if (baseline.preExistingFailures.length > 0) {
                console.log(`   ⚠️  ${baseline.preExistingFailures.length} pre-existing failures`);
            }
        }

    } else if (mode === 'list-tcs') {
        if (!opts.baseline) fail('--baseline required');
        if (!fs.existsSync(opts.baseline)) fail(`Baseline file not found: ${opts.baseline}`);

        const baseline = JSON.parse(fs.readFileSync(opts.baseline, 'utf-8'));

        if (opts.jsonOutput) {
            printJsonTcList(baseline, opts.filterFile, opts.filterStatus);
        } else {
            printTcIndex(baseline, opts.filterFile, opts.filterStatus);
        }

    } else if (mode === 'compare') {
        if (!opts.baseline) fail('--baseline required');
        if (!opts.current) fail('--current required');
        if (!opts.framework || !PARSERS[opts.framework]) fail(`--framework required`);

        if (!fs.existsSync(opts.baseline)) fail(`Baseline not found: ${opts.baseline}`);
        if (!fs.existsSync(opts.current)) fail(`Current results not found: ${opts.current}`);

        const baseline = JSON.parse(fs.readFileSync(opts.baseline, 'utf-8'));

        if (opts.framework === 'junit-xml') {
            fail('compare mode with junit-xml requires pre-parsing to JSON first');
        }
        // Map --current to --input for parser compatibility
        const parseOpts = { ...opts, input: opts.current };
        const currentTests = PARSERS[opts.framework](parseOpts);

        if (opts.jsonOutput) {
            printJsonInterference(baseline, currentTests);
        } else {
            const count = printInterferenceReport(baseline, currentTests, opts.culprit || '');
            process.exit(count === 0 ? 0 : 1);
        }

    } else {
        fail(`Unknown mode: ${mode}. Use capture, parse, list-tcs, or compare.`);
    }
}

main();
