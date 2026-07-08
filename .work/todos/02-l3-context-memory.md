# L3 — Context & Memory: Cải Thiện

**Ngày tạo:** 2026-07-08
**Độ ưu tiên:** High
**Trạng thái:** pending

## Mục Tiêu

Nâng cấp context & memory từ "khá" (3/5) lên "rất tốt" (4/5) qua 3 cải tiến.

## Todo

### 1. Knowledge Graph cho Cross-Referencing Specs

**Vấn đề:** Specs hiện tại là file-based, không có cross-referencing. SRS → HLD → LLD → IMP → TST link với nhau qua naming convention, không có structured relationship. Khi update 1 spec, không biết specs nào khác bị ảnh hưởng.

**Giải pháp:**
- Triển khai SQLite-backed knowledge graph trong `.work/knowledge-graph.db`
- Nodes: FR, NFR, ADR, Service, API, Domain Model, Test Case, Feature
- Edges: TRACES_TO, IMPLEMENTS, TESTS, DEPENDS_ON, CONFLICTS_WITH
- Tự động populate khi agent tạo specs (thêm vào agent output contract)
- Query được: "những test case nào bị ảnh hưởng khi FR-003 thay đổi?"

**Tham khảo:** [sdlc-harness](https://github.com/madhavmadupu/sdlc-harness) — SQLite KG với structural nodes + reasoning traces

---

### 2. Traceability Matrix Tự Động

**Vấn đề:** Traceability matrix hiện tại nằm trong SRS document (thủ công). Khi specs thay đổi, matrix không tự update.

**Giải pháp:**
- Traceability matrix sinh tự động từ knowledge graph
- Query: FR → IMP specs → TST specs → Test results
- Format: markdown table trong `agent_docs/traceability.md`, auto-generated mỗi khi có spec change
- Tích hợp vào `sdlc-srs-synthesis` và `codebase-srs-synthesis` agents

**Tham khảo:** SRS synthesis agents hiện tại — mở rộng output contract

---

### 3. Context Window Optimization

**Vấn đề:** Context window management hiện tại là thủ công (load references on-demand). Không có automated compaction, không có priority-based loading. Agent có thể load quá nhiều context không cần thiết.

**Giải pháp:**
- Implement context budget per agent type (vd: SRS agent ≤ 80K tokens, GREEN agent ≤ 40K tokens)
- Progressive disclosure: core facts → related specs → full references (3 mức)
- Automated compaction: summarize completed phases trước khi load context phase mới
- Thêm `context-budget` directive vào mỗi agent's system prompt

**Tham khảo:** LangChain's context engineering patterns, Anthropic's prompt caching strategies
