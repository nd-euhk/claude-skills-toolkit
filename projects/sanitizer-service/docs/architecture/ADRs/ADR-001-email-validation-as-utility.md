---
title: "ADR-001: Email Validation as Utility Function Instead of Microservice"
status: accepted
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - ../../product/SRS.md
referenced_by:
  - ../system-architecture.md
  - ../../../agent_docs/architecture.md
changelog:
  - 1.0 | 2026-06-01 | Initial decision
---

# ADR-001: Email Validation as Utility Function Instead of Microservice

## Context

The Email Validation Utility must validate whether a candidate email string conforms to a basic email address format (SRS FR-VAL-001) and handle null/empty inputs gracefully (SRS FR-VAL-002). The SRS defines three key constraints:

- **C-001**: The utility must operate synchronously -- callers receive an immediate result.
- **C-002**: The utility must be stateless -- each invocation is independent.
- **C-003**: The utility must not perform any I/O operations.

The utility has zero external dependencies (SRS Section 4.3). It will be used by three callers: the user registration flow, the login flow, and the profile update flow (SRS Section 1.1).

We must decide how to package and deploy this capability: as a standalone microservice reachable over the network, or as an in-process utility function imported as a library.

## Decision

**We will implement email validation as an in-process utility function (`validate_email`) within the existing `sanitizer-service` Python package. It will NOT be deployed as a standalone microservice.**

The function is importable: `from src.sanitizer import validate_email`. Callers invoke it synchronously with no network hop.

## Rationale

| Option | Pros | Cons |
|--------|------|------|
| **Option A: Utility function (chosen)** | Zero network latency (meets NFR-PERF-001: <1ms P95). No serialization overhead. No deployment complexity. No network failure modes. Matches stateless constraint C-002 naturally. | Couples callers to the Python runtime. Cannot be called from non-Python services without a wrapper. |
| Option B: Microservice (REST/gRPC) | Language-agnostic. Independent deployability. Independent scaling. | Introduces network latency (~1-5ms minimum) that exceeds NFR-PERF-001 threshold. Adds serialization overhead. Adds deployment/infrastructure complexity. Requires health checks, circuit breakers, service discovery. Violates the spirit of constraint C-001 (immediate result). Over-engineered for a pure computation with no state and no dependencies. |
| Option C: Serverless function (Lambda/Cloud Function) | Lower operational overhead than a full microservice. | Still introduces cold-start latency. Network hop still required. More infrastructure than needed. Same latency and complexity concerns as microservice. |

### Why Option A

1. **Performance (NFR-PERF-001)**: The SRS requires P95 latency under 1ms for inputs up to 254 characters. Network round-trip alone (even on localhost) adds ~0.1-0.5ms minimum, and real network adds 1-5ms, making the threshold impossible to meet with a remote call.

2. **Simplicity**: The utility has zero dependencies, zero state, and zero I/O. Deploying it as a microservice would introduce infrastructure concerns (container, health check, service discovery, load balancer) that add no value.

3. **Synchronous constraint (C-001)**: An in-process function call is the fastest possible synchronous invocation. Any remote call adds failure modes (network partition, timeout, retry logic) that the SRS explicitly avoids.

4. **Stateless constraint (C-002)**: A standalone process with no state is isomorphic to a function with no state. The microservice boundary provides no isolation benefit here.

5. **Reusability (NFR-MNT-001)**: As a Python function, the validation logic is callable from any Python code in the user service (registration, login, profile update) with zero configuration.

## Consequences

### Positive

- Guarantees sub-millisecond response time, meeting NFR-PERF-001.
- No network failure modes to handle -- the only error condition is invalid input, which returns `false`.
- Zero infrastructure cost: no containers, no load balancers, no service discovery.
- Simple testing: unit tests call the function directly, no mocks needed.
- Meets all three constraints (C-001, C-002, C-003) naturally.

### Negative

- Callers must be Python -- non-Python services cannot use this utility directly.
- The utility and its callers share the same process, so a bug in one could theoretically affect the other (mitigated by the utility being pure and stateless).
- Changes to the validation logic require redeploying the entire user service (acceptable for a utility that changes infrequently).

### Risks

- **Risk**: Future requirement for non-Python callers. **Mitigation**: If a non-Python caller emerges, wrap the Python function in a thin REST/gRPC layer -- this is an incremental change, not a rewrite.
- **Risk**: The utility grows to require external dependencies (DNS lookups, blocklist checks). **Mitigation**: An ADR amendment would re-evaluate the architecture style at that point.

## Related

- SRS Constraints: C-001 (synchronous), C-002 (stateless), C-003 (no I/O)
- NFR: NFR-PERF-001 (<1ms P95), NFR-PERF-002 (<5ms P99), NFR-PERF-003 (<0.5ms P95)
- NFR: NFR-MNT-001 (reusable across registration, login, profile update)
