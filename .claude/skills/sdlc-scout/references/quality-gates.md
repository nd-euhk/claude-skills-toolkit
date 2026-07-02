# Quality Gates — sdlc-scout

Tiêu chí xác minh chất lượng cho scout report. Dùng bởi chính sdlc-scout khi tự kiểm tra, và bởi skill SDLC hạ nguồn khi verify report trước khi dùng.

## Gate 1: Report Completeness (bắt buộc)

Sau khi sinh report, kiểm tra các phần bắt buộc có mặt và không rỗng:

| Phần | Bắt buộc? | Cách kiểm tra |
|------|-----------|---------------|
| Tổng quan | Có | ≥2 câu, không phải placeholder |
| Tóm tắt | Có | Có số liệu (file count, patterns, technologies, modules) |
| Các File Liên Quan | Có | Ít nhất 1 file được liệt kê |
| Công Nghệ Sử Dụng | Có | Ít nhất 1 technology được phát hiện |
| Cấu Trúc Thư Mục | Có | Phản ánh đúng cấu trúc thư mục đích |
| Modules và Trách Nhiệm | Có (review mode) | Mỗi module có responsibility + dependencies |
| Entry Points | Có (review mode) | Ít nhất 1 entry point nếu codebase có |
| Dependencies | Có | Internal + external tables |
| Architectural Patterns | Có (review mode) | Ít nhất 1 pattern kèm evidence `file:line` |
| Câu Hỏi Chưa Giải Quyết | Có nếu có gaps | Liệt kê gaps hoặc "Không có" |

**Cách chạy:**

```bash
# Kiểm tra các section header tồn tại
grep -c "^## " {reportPath}
# Phải ≥ 8 (với review mode) hoặc ≥ 5 (với non-review mode)

# Kiểm tra không có placeholder
grep -i "TODO\|FIXME\|PLACEHOLDER\|chưa có" {reportPath} && echo "FAIL: placeholder found"
```

**Pass criteria**: Tất cả section bắt buộc có mặt, không placeholder.

## Gate 2: Coverage Audit (tự động với pipeline strategy, thủ công với direct strategy)

So sánh thư mục đã scout với thư mục thực tế:

```bash
# Liệt kê tất cả thư mục trong target path
find {targetPath} -type d -not -path '*/node_modules/*' -not -path '*/.git/*' \
  -not -path '*/vendor/*' -not -path '*/dist/*' -not -path '*/build/*' | sort > /tmp/dirs-actual.txt

# Trích xuất thư mục từ report (từ phần "Cấu Trúc Thư Mục")
grep -E '^\s*(├──|└──|[│├└].*─)' {reportPath} | \
  sed 's/.*─ //' | sort > /tmp/dirs-reported.txt

# Tìm thư mục không có trong report
comm -23 /tmp/dirs-actual.txt /tmp/dirs-reported.txt > /tmp/dirs-missed.txt
```

**Pass criteria**: ≤10% thư mục bị bỏ sót (hoặc 0 thư mục bị bỏ sót nếu codebase <100 dirs).

## Gate 3: Schema Compliance

Kiểm tra return data object khớp với schema trong `references/report-format.md`:

| Trường | Required | Non-empty |
|--------|----------|-----------|
| `reports[].name` | ✅ | ✅ |
| `reports[].outputPath` | ✅ | ✅ (file tồn tại) |
| `reports[].filesFound` | ✅ | ✅ (>0) |
| `reports[].highRelevance` | ✅ | ✅ |
| `reports[].patternsObserved` | ✅ | ✅ |
| `reports[].technologiesDetected` | ✅ | ✅ |
| `reports[].modulesFound` | ✅ | ≥0 |
| `reports[].entryPointsFound` | ✅ | ≥0 |
| `reports[].questions` | ✅ | ≥0 |
| `gaps` | Chỉ khi foundGaps=true | Nếu foundGaps=true: có missedDirectories hoặc uncoveredTopics |

**Pass criteria**: Tất cả required fields có mặt và đúng kiểu.

## Gate 4: Performance Gate

| Scenario | Expected Time | Max Agents | Pass |
|----------|---------------|------------|------|
| Direct, <50 files | <2 phút | 1-2 | Tất cả agent hoàn thành |
| Direct, 50-200 files | <4 phút | 2-4 | ≤1 agent timeout |
| Pipeline, 200-500 files | <8 phút | 4-8 | Tất cả sub-project có report |
| Pipeline, >500 files | <15 phút | 8-16 | ≤1 sub-project failed |

**Cách kiểm tra**: Ghi nhận thời gian bắt đầu/kết thúc trong report metadata.

## Gate 5: Relevance Gate

Sau khi scout, xác minh file được tìm thấy có liên quan đến `--focus`:

1. Đếm file `highRelevance` / `filesFound` → tỉ lệ ≥ 10% là healthy
2. Nếu tỉ lệ < 10% → có thể `--patterns` quá hẹp hoặc `--focus` không khớp codebase
3. Nếu tỉ lệ > 50% → có thể `--patterns` quá rộng, cần refine

## Self-Test Mode

Khi được gọi với `--mode self-test`, sdlc-scout chạy kiểm tra nhanh trên thư mục hiện tại:

```
/sdlc-scout . --mode self-test
```

Quy trình self-test:
1. Chạy scout với `--mode review` trên thư mục hiện tại
2. Chạy Gate 1 (Completeness) trên report sinh ra
3. Chạy Gate 3 (Schema) trên return data
4. Nếu codebase <200 file → chạy Gate 2 (Coverage) thủ công
5. Trả về: `{selfTest: {passed: true/false, gates: {completeness, schema, coverage}, duration: ms}}`

## Integration Test Patterns Cho Downstream Skills

Skill SDLC gọi sdlc-scout nên verify report trước khi dùng:

```js
// Pattern: Verify scout report trước khi dispatch downstream agents
function verifyScoutReport(scoutResult) {
  const checks = []

  // Check 1: Status is not failed
  if (scoutResult.status === 'failed') {
    return { ok: false, reason: 'Scout failed completely', scoutResult }
  }

  // Check 2: At least one report has files
  const hasFiles = scoutResult.reports.some(r => r.filesFound > 0)
  if (!hasFiles) {
    return { ok: false, reason: 'No files found in any report', scoutResult }
  }

  // Check 3: Reports exist on disk
  for (const r of scoutResult.reports) {
    try {
      const content = Read(r.outputPath)
      if (!content || content.length < 100) {
        checks.push({ report: r.name, issue: 'Report too short or empty' })
      }
    } catch {
      checks.push({ report: r.name, issue: 'Report file not found on disk' })
    }
  }

  // Check 4: Partial failure — warn but continue
  if (scoutResult.status === 'partial' || scoutResult.failedReports?.length > 0) {
    checks.push({
      issue: 'Partial scout — some sub-projects failed',
      failedReports: scoutResult.failedReports,
    })
  }

  return {
    ok: checks.length === 0 || scoutResult.status === 'partial',
    checks,
    scoutResult,
  }
}

// Usage:
const scoutResult = await Skill('sdlc-scout', '{path} --mode review --focus "{focus}"')
const verified = verifyScoutReport(scoutResult)
if (!verified.ok) {
  // AskUserQuestion: "Scout không đầy đủ. Tiếp tục với dữ liệu có sẵn?"
}
```

## Quality Gate Checklist (Quick Reference)

Trước khi coi scout là hoàn tất:

- [ ] Report tồn tại trên disk và >100 dòng
- [ ] Tất cả section bắt buộc có mặt (8+ headers)
- [ ] Return data khớp schema (required fields non-empty)
- [ ] Coverage ≥90% directories (nếu audit được chạy)
- [ ] Tỉ lệ highRelevance/filesFound trong khoảng 10-50%
- [ ] Không có agent timeout không được ghi nhận
- [ ] Gaps được document đầy đủ (không bỏ qua thầm lặng)
