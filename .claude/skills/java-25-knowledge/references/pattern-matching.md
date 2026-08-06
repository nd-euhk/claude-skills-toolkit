# Pattern Matching in Java 25

Read this when writing `switch` expressions/statements, `instanceof` checks,
or record deconstruction patterns.

## What's stable vs what's preview

| Feature | Status in Java 25 |
|---|---|
| Pattern Matching for `instanceof` | **Finalized (Java 16)** — no flag needed |
| Pattern Matching for `switch` | **Finalized (Java 21)** — no flag needed |
| Record Patterns | **Finalized (Java 21)** — no flag needed |
| Unnamed Patterns (`_`) | **Finalized (Java 22)** — no flag needed |
| **Primitive Types in Patterns** (JEP 507) | **Preview in Java 25** — needs `--enable-preview` |

## Patterns finalized before Java 25 — full reference

All of these work in Java 25 without any flags:

### `instanceof` pattern matching (Java 16, finalized)

```java
// OLD
if (obj instanceof String) {
    String s = (String) obj;
    process(s);
}

// JAVA 16+
if (obj instanceof String s) {
    process(s); // s is already typed as String, no cast
}

// With guard condition
if (obj instanceof String s && s.length() > 5) {
    process(s);
}
```

### Pattern matching for `switch` (Java 21, finalized)

```java
// switch over any Object type — not just int/String/enum
String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "Integer: " + i;
        case String s  -> "String: " + s;
        case null      -> "null";
        default        -> "other: " + obj;
    };
}

// With guard (when clause)
String classify(Object obj) {
    return switch (obj) {
        case Integer i when i > 0  -> "positive int";
        case Integer i when i < 0  -> "negative int";
        case Integer i             -> "zero";
        case String s when s.isEmpty() -> "empty string";
        case String s              -> "non-empty string";
        default                    -> "other";
    };
}
```

### Record patterns (Java 21, finalized)

```java
record Point(int x, int y) {}
record Line(Point start, Point end) {}

// Deconstruct a record in instanceof
if (obj instanceof Point(int x, int y)) {
    System.out.println("x=" + x + ", y=" + y);
}

// Nested record patterns in switch
String describe(Object shape) {
    return switch (shape) {
        case Point(int x, int y)            -> "point at " + x + "," + y;
        case Line(Point(int x1, _), Point(int x2, _))
                                            -> "line from x=" + x1 + " to x=" + x2;
        default                             -> "unknown";
    };
}
```

### Unnamed patterns with `_` (Java 22, finalized)

```java
// Ignore parts you don't need
if (obj instanceof Point(int x, _)) {
    // only care about x, not y
    System.out.println("x=" + x);
}

// In switch — unnamed variable for type matching without binding
switch (obj) {
    case Integer _ -> System.out.println("it's an Integer");
    case String _  -> System.out.println("it's a String");
    default        -> System.out.println("other");
}
```

## Sealed classes + pattern matching (common combination)

Sealed classes (finalized Java 17) and pattern switch work together to
produce exhaustive matching — the compiler knows exactly which subtypes
exist and verifies you've covered all of them:

```java
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double width, double height) implements Shape {}
record Triangle(double base, double height) implements Shape {}

double area(Shape shape) {
    return switch (shape) {
        case Circle(double r)          -> Math.PI * r * r;
        case Rectangle(double w, double h) -> w * h;
        case Triangle(double b, double h)  -> 0.5 * b * h;
        // No default needed — compiler verifies exhaustiveness
        // If you add a new Shape subtype, this switch becomes a compile error
    };
}
```

## Primitive Types in Patterns (JEP 507) — PREVIEW, needs flag

In Java 25, `switch` and `instanceof` only work with **reference types** when
using patterns. JEP 507 (still 3rd preview in Java 25) extends this to
primitive types:

```bash
# Needs --enable-preview in Java 25
javac --enable-preview --release 25 Example.java
java  --enable-preview Example
```

```java
// Java 25 PREVIEW ONLY — not stable, API may change in Java 26
Object obj = 42;
if (obj instanceof int i) { // primitive type pattern — preview
    System.out.println("int: " + i);
}

switch (someDouble) { // switch over a primitive type with patterns — preview
    case double d when d > 0 -> "positive";
    case double d            -> "non-positive";
}
```

Do not use this in production code targeting Java 25 without accepting that
the syntax may change or be removed in Java 26.

## Common mistakes (these compile and run, but are wrong or won't compile)

- **Writing `--enable-preview` for `switch` pattern matching or record patterns.**
  These were finalized in Java 21. Agents with pre-25 training data may suggest
  the flag because they remember these features being preview — they are not
  anymore. The flag is only needed for JEP 507 (primitive types in patterns).
- **Forgetting a `default` case in a switch over a non-sealed type.** A sealed
  type exhaustiveness check doesn't apply to open hierarchies (regular
  interfaces, non-sealed classes) — those still need a `default` or the
  compiler errors.
- **Using a record pattern in an exhaustive `switch` and forgetting to update
  it after adding a component to the record.** The compiler enforces exhaustiveness
  at the type level, not at the field level — adding a field to the record
  doesn't automatically break existing record patterns (the `_` for unnamed
  components can mask the gap).
