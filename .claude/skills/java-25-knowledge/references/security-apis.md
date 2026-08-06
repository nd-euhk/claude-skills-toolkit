# Security APIs in Java 25

**Status: Key Derivation Function API (JEP 510) — FINALIZED.
PEM Encodings (JEP 470) — still PREVIEW.**

Read this when working with cryptographic key derivation, or encoding/decoding
cryptographic objects to/from PEM format.

## Key Derivation Function API (JEP 510) — Finalized

A KDF derives new cryptographic keys from an existing secret key plus some
additional data (salt, context info). This is standard in protocols like TLS,
secure password storage, and key exchange schemes.

Before Java 25, KDFs had to be implemented manually or through provider-specific
APIs. Java 25 provides a standard, provider-agnostic API in `javax.crypto`.

```java
import javax.crypto.KDF;
import javax.crypto.SecretKey;
import javax.crypto.spec.HKDFParameterSpec;

// HKDF (HMAC-based Key Derivation Function) — common in TLS 1.3
KDF hkdf = KDF.getInstance("HKDF-SHA256");

byte[] inputKeyMaterial = ...; // existing secret
byte[] salt = ...;             // random or protocol-defined
byte[] info = "session-key".getBytes(); // context info

SecretKey derived = hkdf.deriveKey("AES",
    HKDFParameterSpec.ofExpand(
        HKDFParameterSpec.extractOnly(salt, inputKeyMaterial),
        info, 32 /* bytes */
    )
);
```

Supported algorithms (provider-dependent, available in the JDK default provider):
- `HKDF-SHA256`, `HKDF-SHA384`, `HKDF-SHA512`
- `PBKDF2WithHmacSHA256` and similar (available through the existing
  `SecretKeyFactory` API, not KDF — the new `KDF` API covers extract-expand
  style KDFs like HKDF)

**When to use:** building TLS extensions, token derivation, session key
generation, or any protocol that specifies HKDF in its key schedule.
For simple password hashing (login systems), `BCrypt`/`Argon2` via a
library is still the right choice — `KDF` is not a password hashing API.

## PEM Encodings API (JEP 470) — STILL PREVIEW in Java 25

**Requires `--enable-preview` — do NOT use in production without accepting
the API may change in Java 26.**

PEM (Privacy-Enhanced Mail) is the `-----BEGIN CERTIFICATE-----` format used
everywhere for cryptographic objects — keys, certificates, CSRs.

Before Java 25, reading/writing PEM required third-party libraries (Bouncy
Castle) or manual Base64 manipulation. JEP 470 adds a standard API:

```java
// --enable-preview required in Java 25
import java.security.PEMDecoder;
import java.security.PEMEncoder;

// Decoding a PEM-encoded private key
PEMDecoder decoder = PEMDecoder.of();
PrivateKey key = (PrivateKey) decoder.decode(pemString);

// Encoding a certificate to PEM
PEMEncoder encoder = PEMEncoder.of();
String pem = encoder.encode(certificate);
```

**When to use:** handling TLS certificates, reading keys from files/env vars
in PEM format, writing certificate management utilities. If the project already
uses Bouncy Castle for PEM handling, there's no need to switch to the preview API
— wait for JDK 26 when it should be finalized.

## Common mistakes

- **Using `KDF.getInstance("HKDF-SHA256")` and confusing it with password
  hashing.** HKDF is for key derivation in cryptographic protocols, not for
  user password storage — it's too fast to be safe for password hashing
  (attackers can brute-force it quickly). Use a password hashing library with
  a memory-hard function (Argon2, BCrypt) for user passwords.
- **Adding `--enable-preview` for `KDF` usage.** The KDF API is finalized —
  no flag needed. Only `PEMDecoder`/`PEMEncoder` (JEP 470) requires the flag.
- **Using `PEMDecoder` in production code without accepting the preview risk.**
  Since JEP 470 is still preview, the class names and method signatures may
  change in JDK 26. Bouncy Castle is a stable alternative for PEM handling now.
