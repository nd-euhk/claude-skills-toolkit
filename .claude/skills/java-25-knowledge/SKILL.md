---
name: java-25-knowledge
version: 1.0.0
user-invocable: false
allowed-tools: Read, Write, Bash
description: Use whenever writing, reviewing, or migrating Java code that targets JDK 25 (the LTS released September 16, 2025). Agent training data predating January 2025 has zero knowledge of Java 25 — it does not know which features were finalized, which are preview-only, and critically, which older patterns (ThreadLocal, AOT setup commands, constructor restrictions) have better modern replacements. This skill is the authoritative, self-contained reference. Trigger before writing any Java 25 code, before suggesting concurrency primitives (ThreadLocal vs ScopedValue), before writing constructors with pre-super() logic, before writing AOT/startup optimization commands, before importing module packages, before any GC or JVM flag recommendations, and any time the code comment or context says "java 25", "jdk 25", or "lts". Do not rely on prior knowledge of Java 22–24 preview features — treat everything below as the ground truth for what is stable and production-safe in Java 25.
---

# Java 25 — Self-Contained Reference for Agent Knowledge Cutoff Before Sep 2025

Java 25 (JDK 25) was released on **September 16, 2025** as the next Long-Term
Support release after Java 21. It delivers **18 JEPs** covering language,
libraries, performance, and runtime. Oracle provides at least 8 years of
support.

**Critically for agents with a January 2025 cutoff:** several features that were
preview or incubator in JDK 21–24 are now **permanently finalized** in JDK 25 —
meaning they no longer require `--enable-preview` at compile or runtime. Writing
code that adds `--enable-preview` for these features is wrong. Conversely,
features still in preview in JDK 25 must still use `--enable-preview` and should
not be used in production code without that flag.

## How to use this skill

Work through the table below to find what the task involves, then read the
matching reference file for full examples. The "Core language changes" section
below covers features too small for their own file.

| Task involves... | Read this |
|---|---|
| Passing context across threads, replacing `ThreadLocal` | `references/scoped-values.md` |
| Concurrency: parallel tasks, structured shutdown, fork/join | `references/structured-concurrency.md` |
| Virtual threads (`Thread.ofVirtual()`, executor config) | `references/virtual-threads.md` |
| JVM startup, AOT cache, warmup time | `references/startup-performance.md` |
| GC selection, object memory sizing | `references/gc-and-memory.md` |
| Cryptography: key derivation, PEM encoding | `references/security-apis.md` |
| Pattern matching, switch, primitive types in patterns | `references/pattern-matching.md` |
| Core language: constructors, module imports, compact files | "Core language changes" below |
| Which features are preview vs finalized — before using any feature | "Feature status table" below |

---

## Feature status table — read before using any Java 25 feature

The most dangerous mistake for an agent with an old cutoff is adding
`--enable-preview` when it's no longer needed (marks code as unstable, changes
build/run commands unnecessarily) or — worse — treating a still-preview feature
as stable and omitting the required flag (code silently compiles but may break
when the API changes in JDK 26+).

### Finalized in Java 25 — NO `--enable-preview` needed, safe for production

| JEP | Feature | What it does |
|---|---|---|
| 506 | **Scoped Values** | Immutable, thread-safe context sharing — `ScopedValue.where(...).run(...)` |
| 512 | **Compact Source Files / Instance Main Methods** | Simplified entry points for scripts and learning |
| 510 | **Key Derivation Function API** | Cryptographic KDF (`HKDF`, `PBKDF2`) |
| 519 | **Compact Object Headers** | Opt-in: smaller JVM object headers (64-bit vs 96-128-bit) |
| 514 | **AOT Class Loading & Linking** | Simplified `java -XX:AOTCacheOutput=app.aot` workflow |
| 515 | **Ahead-of-Time Method Profiling** | JIT profiles persisted across restarts in AOT cache |
| 516 | **Generational Shenandoah GC** | Low-latency GC with generational support — stable |
| 511 | **Module Import Declarations** | `import module java.base;` imports all exported packages |
| 513 | **Flexible Constructor Bodies** | Code before `super()`/`this()` calls is now legal |
| 508 | **Vector API** (10th Incubator) | Math/AI vector ops — incubator, not preview; needs `--add-modules jdk.incubator.vector` |
| 509 | **JFR CPU-Time Profiling** | JFR CPU profiling on Linux — experimental JVM feature, no code change |
| 517 | **Remove 32-bit x86 Port** | Platform-only; no API or code impact |

### Still in PREVIEW in Java 25 — requires `--enable-preview`, NOT for production

| JEP | Feature | Preview round |
|---|---|---|
| 507 | Primitive Types in Patterns, instanceof, switch | 3rd preview |
| 502 | Stable Values API | 1st preview |
| 470 | PEM Encodings of Cryptographic Objects | 1st preview |
| 505 | Structured Concurrency | 5th preview — see `references/structured-concurrency.md` for nuance |

**Rule:** if a feature appears in the "still preview" table, always add `--enable-preview`
to both `javac` and `java` invocations, and document in code comments that the
API is subject to change. Never present preview APIs as stable recommendations.

---

## Core language changes (covered here, not in a separate file)

### Flexible Constructor Bodies (JEP 513) — finalized

Before Java 25, code inside a constructor had to call `super()` or `this()` as
the **very first statement** — no validation, no computation, no field assignment
was allowed before that call. This forced awkward workarounds (static helper
methods, intermediate variables) for common patterns like input validation.

```java
// BEFORE Java 25 — compilation error if you try to validate before super()
class BoundedList<E> extends ArrayList<E> {
    BoundedList(int maxSize, Collection<E> items) {
        // super(items); // <- had to be first — couldn't validate maxSize first
        if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be positive");
        super(items); // Error in Java < 25: statement before super()
    }
}

// JAVA 25 — legal, clean, no workaround needed
class BoundedList<E> extends ArrayList<E> {
    BoundedList(int maxSize, Collection<E> items) {
        if (maxSize <= 0) throw new IllegalArgumentException("maxSize must be positive");
        super(items); // super() no longer has to be the first statement
    }
}
```

The rule change: statements before `super()`/`this()` may execute arbitrary
code **except** accessing `this` (the object being constructed doesn't exist yet
until `super()` runs). Validation logic, argument transformation, and field
assignments to `final` fields before calling super are all now legal.

### Module Import Declarations (JEP 511) — finalized

Instead of listing every package from a module individually, import the entire
module's exported packages at once:

```java
// BEFORE — repetitive when using many classes from java.base
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.io.IOException;
// ... many more

// JAVA 25 — one import for the whole module
import module java.base;

// Works for third-party modular libraries too
import module com.fasterxml.jackson.databind;
```

This does **not** require the importing code to itself be in a module — it works
in plain classpath applications. It doesn't change encapsulation: only exported
packages are imported, not internal ones.

### Compact Source Files / Instance Main Methods (JEP 512) — finalized

For scripts, tooling, and learning — not for production application code:

```java
// Java 25 — no class declaration needed for simple programs
void main() {
    System.out.println("Hello from a compact source file");
}
```

```java
// Or as an instance method inside a class (no public static void main(String[]))
class Greeter {
    void main() {
        System.out.println("Hello!");
    }
}
```

This runs with `java HelloWorld.java` directly. It's intentionally a
beginner/scripting feature — production services should still use standard
class structure. Don't suggest this pattern for production Spring Boot
application entry points.

---

## What the agent knows from Java 21 (safe to rely on)

These features were finalized in Java 21 and are stable in any agent trained
before or after:

- **Virtual Threads** (JEP 444) — `Thread.ofVirtual().start(...)`,
  `Executors.newVirtualThreadPerTaskExecutor()`
- **Record Patterns** (JEP 440) — `case Point(int x, int y) ->`
- **Pattern Matching for switch** (JEP 441) — `switch (obj) { case String s -> ... }`
- **Sequenced Collections** (JEP 431) — `SequencedCollection`, `.reversed()`,
  `.getFirst()`, `.getLast()`
- **`record`** types, **`sealed`** classes, **text blocks**, **`instanceof`**
  pattern matching, **`switch` expressions** — all from earlier LTS-era releases

---

## What changed between Java 21 and Java 25 — version-by-version summary for context

The agent's cutoff misses Java 22, 23, 24 (non-LTS), and 25 entirely. This
table summarizes what finalized along the way that's now stable in 25:

| Feature | First appeared | Finalized |
|---|---|---|
| Virtual Threads | 19 (preview) | **21** ✓ already known |
| Record Patterns | 19 (preview) | **21** ✓ already known |
| Pattern Matching for switch | 17 (preview) | **21** ✓ already known |
| Unnamed Patterns & Variables | 21 (preview) | **22** |
| String Templates | 21 (preview) | dropped (removed from roadmap) |
| Unnamed Classes / Instance Main | 21 (preview) | **25** (JEP 512) |
| Scoped Values | 20 (incubator) | **25** (JEP 506) |
| Structured Concurrency | 19 (incubator) | still preview in 25 (JEP 505) |
| Flexible Constructor Bodies | 22 (preview) | **25** (JEP 513) |
| Module Import Declarations | 23 (preview) | **25** (JEP 511) |
| Key Derivation Function API | 24 (preview) | **25** (JEP 510) |
| Compact Object Headers | 24 (experimental) | **25** (JEP 519, opt-in) |

**Notable: String Templates were removed from the roadmap entirely** — they
appeared as preview in JDK 21 and 22, then were withdrawn. Do not suggest
`STR."..."` template syntax — it does not exist in any production Java version.
