# Gate Verification Prompts — All Phases

File này chứa prompt xác minh gate cho tất cả 5 phase. Được gọi bởi `sdlc-phase-manual` skill ở Step 3 của mỗi phase reference file.

Mỗi prompt được thiết kế cho `Agent(Explore)` — read-only verification, không sửa file.

## Prompt Format Chung

```
Đọc file tiêu chí gate {PHASE} tại .claude/agents/_shared/gate-verifier/gate-verifier-{X}.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
{phase-specific artifact list}

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: {PHASE}

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

{phase-specific check table section}

### Tóm Tắt
- Đạt: N
- Không đạt: N
- Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```

---

## SRS Gate Verification

**Dùng cho phase:** SRS
**Prompt cho Agent(Explore):**

```
Đọc file tiêu chí gate SRS tại .claude/agents/_shared/gate-verifier/gate-verifier-srs.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- docs/product/SRS.md
- docs/product/features/*/FR-*.md (tất cả file FR)
- agent_docs/traceability/requirements-matrix.md

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: SRS

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Độ Chi Tiết FR
| File FR | Kết luận | Vấn đề |
|---------|---------|-------|
| FR-...md | QUÁ THÔ | "Xác thực" — tách thành Đăng nhập, Đăng ký, Đặt lại mật khẩu |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```

---

## HLD Gate Verification

**Dùng cho phase:** HLD
**Prompt cho Agent(Explore):**

```
Đọc file tiêu chí gate HLD tại .claude/agents/_shared/gate-verifier/gate-verifier-hld.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- docs/architecture/system-architecture.md
- docs/architecture/ADRs/*
- agent_docs/architecture.md
- agent_docs/domain-service-mapping.yaml
- agent_docs/hard-boundaries.md
- agent_docs/contracts/api-conventions.md
- agent_docs/contracts/events.md
- docs/architecture/diagrams/*

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: HLD

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Độ Bao Phủ Service
| Service | Mức Độ Bao Phủ | Vấn Đề |
|---------|---------------|-------|
| {service} | ĐẦY ĐỦ/THIẾU | {nếu thiếu, mô tả} |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```

---

## LLD Gate Verification

**Dùng cho phase:** LLD
**Prompt cho Agent(Explore):**

```
Đọc file tiêu chí gate LLD tại .claude/agents/_shared/gate-verifier/gate-verifier-lld.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/tech-design/README.md
- agent_docs/tech-design/{name}-service.md (tất cả services)
- agent_docs/tech-design/cross-cutting.md
- agent_docs/contracts/api-{domain}.yaml (tất cả APIs)
- docs/product/features/*/FR-*.md (tất cả work packages)

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: LLD

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra 9 Section Đầy Đủ
| Service File | Thiếu Section |
|-------------|--------------|
| {service}.md | {danh sách section thiếu, hoặc "ĐẦY ĐỦ"} |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```

---

## IMP Gate Verification

**Dùng cho phase:** IMP
**Prompt cho Agent(Explore):**

```
Đọc file tiêu chí gate IMP tại .claude/agents/_shared/gate-verifier/gate-verifier-imp.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/backend/{service}/implementation/FR-*-impl.md (tất cả backend impl specs)
- agent_docs/frontend/{app}/implementation/FR-*-impl.md (tất cả frontend impl specs)

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: IMP

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra 10 Section Đầy Đủ
| File IMP | Thiếu Section |
|----------|--------------|
| FR-*-impl.md | {danh sách section thiếu, hoặc "ĐẦY ĐỦ"} |

### Kiểm Tra Error Mapping
| File IMP | Thiếu Error Types |
|----------|------------------|
| FR-*-impl.md | {danh sách error types thiếu} |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```

---

## TST Gate Verification

**Dùng cho phase:** TST
**Prompt cho Agent(Explore):**

```
Đọc file tiêu chí gate TST tại .claude/agents/_shared/gate-verifier/gate-verifier-tst.md.
Chạy MỌI tiêu chí trong file đó trên các artifacts sau:

Artifacts cần xác minh:
- agent_docs/backend/{service}/test-specs/FR-*-test.md (tất cả backend test specs)
- agent_docs/frontend/{app}/test-specs/FR-*-test.md (tất cả frontend test specs)
- agent_docs/performance/nfr-mapping.md
- agent_docs/performance/baseline.md

Với mỗi tiêu chí, báo cáo: ĐẠT (kèm bằng chứng cụ thể: file:dòng hoặc trích dẫn), KHÔNG ĐẠT (kèm bằng chứng cụ thể và lý do), hoặc BỎ QUA (nếu artifact không tìm thấy).

Tổng hợp kết quả dạng:
## Báo Cáo Xác Minh Gate: TST

**Kết luận:** {ĐẠT / KHÔNG ĐẠT với N vấn đề}

### Kết Quả
| # | Tiêu chí | Kết quả | Bằng chứng |
|---|-----------|--------|----------|
| 1 | {tiêu chí} | ĐẠT/KHÔNG ĐẠT | {file:dòng hoặc trích dẫn cụ thể} |

### Kiểm Tra Risk Level
| File Test | Thiếu Risk Level |
|-----------|-----------------|
| FR-*-test.md | {section thiếu risk level, hoặc "ĐẦY ĐỦ"} |

### Kiểm Tra HTTP Status Coverage
| Endpoint | Thiếu Status Codes |
|----------|-------------------|
| {endpoint} | {danh sách status codes thiếu} |

### Tóm Tắt
- Đạt: N / Không đạt: N / Bỏ qua: N

LƯU Ý: Đây là xác minh CHỈ ĐỌC. Không sửa bất kỳ file nào. Chỉ báo cáo kết quả.
```
