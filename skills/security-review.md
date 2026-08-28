# Skill: Security Assessment — Feature-Level

## When to Use
Invoke this skill when asked to perform a security assessment on a specific feature. It covers the full threat surface: business logic flaws, injection attacks, auth/authorisation gaps, data exposure, fraud vectors, and abuse.

Trigger phrases: "security review of [feature]", "audit [feature] for vulnerabilities", "find security flaws in [feature]", "fraud risk assessment".

---

## Inputs Required Before Starting

Gather these before executing any step. If any are missing, ask:

| Input | Source | Why needed |
|-------|--------|------------|
| Feature name / scope | User or Jimmy's spec | Defines what to audit |
| Feature Spec or requirements | Jimmy's spec file | Reveals business logic and user roles |
| Architecture Plan | Architect's plan file | Reveals endpoints, auth guards, data flows |
| Implementation files | Codebase | The actual thing being audited |
| User roles and permissions | Spec or ONBOARDING.md | Needed for authorisation checks |
| Sensitive data types involved | Spec or schema | Needed for data exposure checks |
| DB schema / migrations | Codebase | Needed for injection and exposure checks |

If no implementation exists yet (spec-only review): execute Steps 1–3 and Steps 6–7 only and label the report **PRE-BUILD THREAT MODEL**.

---

## Execution Steps

### Step 1 — Map the Feature's Attack Surface

Before checking anything, build a complete picture of what exists:

```
ATTACK SURFACE MAP — [Feature Name]
=====================================
Endpoints:
  [METHOD] /path — [auth: yes/no] — [roles allowed]

User roles involved:
  - [role] — [what they can do]

Sensitive data handled:
  - [field/type] — [where it flows]

External dependencies:
  - [third-party API / payment gateway / webhook / file store]

Trust boundaries crossed:
  - [user → backend] [backend → DB] [backend → external API] etc.
```

Do not skip this step. Every subsequent check is run against this map.

---

### Step 2 — Business Logic & Fraud Assessment

This is checked first because business logic flaws are the most feature-specific and hardest to catch with generic scanners. For each finding, describe the exact exploit path.

**2a. Financial / Transaction Logic**
- [ ] Can a user manipulate a price, discount, or amount field client-side before submission?
- [ ] Can a transaction be replayed (submitted twice with the same payload)?
- [ ] Is idempotency enforced on payment/charge endpoints?
- [ ] Can a user apply a coupon, promo code, or credit more than once?
- [ ] Can a refund or reversal be triggered without a corresponding original transaction?
- [ ] Can a negative amount be submitted to credit a user's account?
- [ ] Are order totals recalculated server-side — or is the client-submitted total trusted?
- [ ] Can a user checkout with items at a price that has since changed?

**2b. Workflow / State Manipulation**
- [ ] Can a user skip a required step in a multi-step flow (e.g. jump to "complete" without paying)?
- [ ] Can a user trigger a state transition that should only be triggered by a backend job?
- [ ] Can an order/booking/request be cancelled after it has already been fulfilled?
- [ ] Can the same limited resource (seat, slot, stock unit) be claimed by two users simultaneously? (Race condition)
- [ ] Is any irreversible action (delete, transfer, publish) protected by confirmation or idempotency?

**2c. Referral / Reward Abuse**
- [ ] Can a user refer themselves using a different email or device?
- [ ] Can referral or reward credits be triggered without the required qualifying action completing?
- [ ] Is there a limit on how many times a reward action can be triggered per user?

**2d. Account / Identity Manipulation**
- [ ] Can a user change an email or phone number without re-verification?
- [ ] Can a user escalate their own role or permissions through any endpoint?
- [ ] Can a deleted or suspended account be reactivated by the user themselves?

---

### Step 3 — Injection Attack Assessment

For every endpoint that accepts user input, check each vector.

**3a. SQL Injection**
- [ ] Are all DB queries using parameterised queries / prepared statements — no raw string interpolation?
- [ ] Are ORM-provided query builders used correctly — no raw `whereRaw`, `selectRaw`, or `DB::statement` with user input?
- [ ] Are search/filter inputs sanitised before being appended to queries?
- [ ] Are sort-by and order-by fields validated against an allowlist (not passed directly to SQL)?
- [ ] Reference: [OWASP SQL Injection — A03:2021](https://owasp.org/Top10/A03_2021-Injection/)

**3b. NoSQL Injection** *(if using MongoDB, Firestore, Redis, Elasticsearch, etc.)*
- [ ] Are query operators (`$where`, `$gt`, `$regex`) sanitised from user input?
- [ ] Are document IDs validated before use in queries?

**3c. Command Injection**
- [ ] Are there any calls to `exec()`, `shell_exec()`, `system()`, `proc_open()`, `subprocess`, or equivalent with user-supplied input?
- [ ] Are file paths constructed from user input? If yes: is path traversal (`../`) blocked?

**3d. Template Injection (SSTI)**
- [ ] Is any user input rendered inside a template engine (Blade, Jinja2, Twig, Handlebars)?
- [ ] Are template expressions (`{{ }}`, `{% %}`) escaped or stripped from user input?

**3e. XSS (Cross-Site Scripting)**
- [ ] Is any user-supplied content rendered unescaped in HTML responses?
- [ ] Are rich-text or HTML fields sanitised through an allowlist (not a blocklist)?
- [ ] Are Content-Security-Policy headers set on responses that render HTML?
- [ ] Reference: [OWASP XSS — A03:2021](https://owasp.org/www-community/attacks/xss/)

**3f. XML / XXE** *(if XML input is accepted)*
- [ ] Is external entity processing disabled in the XML parser?
- [ ] Is DOCTYPE processing disabled?

---

### Step 4 — Authentication Assessment

- [ ] Is every non-public endpoint protected by auth middleware? List any unprotected endpoints.
- [ ] Is the auth token validated on every request (signature + expiry) — not just checked for presence?
- [ ] Can an expired or revoked token still be used to access protected resources?
- [ ] Are JWTs validated using a secret or key — not accepted unsigned (`alg: none`)?
- [ ] Is there a secure password reset flow — token is single-use, time-limited, and tied to the requesting user?
- [ ] Are failed login attempts rate-limited or locked after N attempts?
- [ ] Is session fixation prevented — session ID rotated on login?
- [ ] Are `HttpOnly` and `Secure` flags set on auth cookies?
- [ ] Reference: [OWASP Broken Authentication — A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)

---

### Step 5 — Authorisation Assessment (IDOR & Broken Access Control)

This is the most common category in modern APIs. Check every endpoint that operates on a resource.

- [ ] **IDOR check:** For every endpoint that accepts a resource ID (`/orders/123`, `/users/45/profile`): does the backend verify the requesting user owns or is permitted to access that specific record — or does it just check that the user is authenticated?
- [ ] Can User A read User B's data by changing an ID in the URL or request body?
- [ ] Can User A modify or delete User B's records?
- [ ] Can a lower-privileged role (e.g. `user`) call an endpoint intended only for `admin`?
- [ ] Are admin-only endpoints protected at the route level — not just hidden from the UI?
- [ ] Is object-level authorisation checked in the service layer — not just the controller?
- [ ] Does the response shape return fields the current user should not see (e.g. another user's email, internal cost price, hidden flags)?
- [ ] Reference: [OWASP IDOR — A01:2021](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)

---

### Step 6 — Data Exposure Assessment

- [ ] Does any API response include PII not needed by the client (SSN, full DOB, hashed passwords, tokens, internal IDs)?
- [ ] Are financial details (card numbers, bank accounts) masked in responses and logs?
- [ ] Are database error messages or stack traces surfaced to the client in error responses?
- [ ] Are secrets, API keys, or credentials present in source code, config files, or `.env` committed to the repo?
- [ ] Are sensitive fields excluded from logs?
- [ ] Is PII encrypted at rest in the DB for this feature's sensitive fields?
- [ ] Are internal system details (server version, framework, internal paths) exposed in response headers or error bodies?
- [ ] Reference: [OWASP Sensitive Data Exposure — A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)

---

### Step 7 — Input Validation & Mass Assignment

- [ ] Is every user-supplied field validated (type, format, length, range) before use — server-side?
- [ ] Are file uploads restricted by MIME type, extension, and file size? Is the file stored outside the web root?
- [ ] Is mass assignment protected — are `fillable` or `guarded` lists defined on every model that accepts input?
- [ ] Can a user inject extra fields (e.g. `is_admin: true`, `role: admin`) into a request and have them persisted?
- [ ] Are enum/select values validated against an allowlist on the server — not just on the frontend?
- [ ] Are numeric inputs (quantities, counts, amounts) validated for minimum values to prevent negative inputs?
- [ ] Reference: [OWASP Mass Assignment — A08:2021](https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/)

---

### Step 8 — Rate Limiting & Abuse Prevention

- [ ] Are authentication endpoints (login, password reset, OTP verify) rate-limited per IP and per account?
- [ ] Are resource-creation endpoints (post, order, upload) rate-limited to prevent spam or resource exhaustion?
- [ ] Are there enumeration risks — endpoints that reveal whether an email, username, or ID exists (timing attack or distinct error messages)?
- [ ] Are webhook endpoints verified (signature check on payload) to prevent spoofed calls?
- [ ] Are there endpoints that trigger expensive operations (reports, exports, emails) callable without throttle?
- [ ] Are bulk-action endpoints (batch delete, batch update) bounded and protected?

---

### Step 9 — Cryptography & Secrets

- [ ] Are passwords hashed with a strong adaptive algorithm (bcrypt, argon2) — never MD5, SHA1, or plain?
- [ ] Are cryptographic tokens (password reset, email verify, API keys) generated with a CSPRNG — not `rand()` or `Math.random()`?
- [ ] Are secrets and keys in environment variables — never hardcoded in source?
- [ ] Are any sensitive values encrypted in the DB (not just hashed)?
- [ ] Is HTTPS enforced on all endpoints — no HTTP fallback?
- [ ] Reference: [OWASP Cryptographic Failures — A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)

---

### Step 10 — Race Conditions & Concurrency

- [ ] Are there operations where two simultaneous requests could produce inconsistent state? (Double-spend, double-booking, duplicate record creation)
- [ ] Is DB-level locking (`SELECT FOR UPDATE`, transactions) used where concurrent writes on the same record are possible?
- [ ] Are idempotency keys enforced on payment, booking, or credit endpoints?
- [ ] Is "check then act" logic (read balance → deduct) protected by a transaction — not two separate queries?
- [ ] Reference: [OWASP Race Conditions](https://owasp.org/www-community/vulnerabilities/Race_Condition)

---

## Severity Scoring

Apply to every finding before writing the report:

| Severity | Criteria |
|----------|----------|
| **Critical** | Exploitable without authentication — data exfiltration, auth bypass, arbitrary code execution, mass fraud |
| **High** | Exploitable by authenticated users — IDOR, privilege escalation, financial manipulation, transaction replay |
| **Medium** | Input not validated (no clear exploit path yet), information disclosure, missing rate limit on sensitive endpoint, single-use token not enforced |
| **Low** | Minor hardening gap, non-sensitive info disclosure, low-risk misconfiguration, cosmetic security header missing |

> Critical and High findings **block the feature from shipping**. Resolve before handoff.

---

## Output — Security Assessment Report

Save as: `{sub-feature}-security-report.md` in the feature documentation folder.

```
SECURITY ASSESSMENT REPORT
===========================
Feature: [Name]
Scope: [Endpoints / components reviewed]
Reviewed By: [Agent or person]
Date: [Date]
Review Type: FULL AUDIT / PRE-BUILD THREAT MODEL
Verdict: PASS / FAIL / CONDITIONAL PASS

SUMMARY
-------
[2-3 sentences: what was reviewed, overall verdict, finding counts by severity]
Critical: [n] | High: [n] | Medium: [n] | Low: [n]

ATTACK SURFACE MAP
------------------
[Paste the map from Step 1]

FINDINGS
--------
| ID | Severity | Category | Location | Vulnerability | Attack Vector | Impact | OWASP Ref | Recommended Fix | Status |
|----|----------|----------|----------|---------------|---------------|--------|-----------|-----------------|--------|
| SEC-01 | Critical | Business Logic | POST /checkout | Price not recalculated server-side | User submits manipulated total | Undercharge / free items | A04:2021 | Recalculate total from DB prices in CheckoutService before charging | Open |
| SEC-02 | High | IDOR | GET /invoices/{id} | No ownership check | Change ID in URL | Access any user's invoice | A01:2021 | Add user_id ownership check in InvoicePolicy | Open |
| SEC-03 | High | SQL Injection | GET /products?sort= | sort param passed to raw query | `sort=name; DROP TABLE` | DB manipulation | A03:2021 | Validate sort against allowlist: ['name','price','created_at'] | Open |

[Continue for all findings. Leave table empty if no findings in a category.]

CHECKLIST RESULTS
-----------------
| Category | Checked | Findings | Notes |
|----------|---------|----------|-------|
| Business Logic & Fraud | ✓ | [n] | |
| SQL / Injection | ✓ | [n] | |
| Authentication | ✓ | [n] | |
| Authorisation / IDOR | ✓ | [n] | |
| Data Exposure | ✓ | [n] | |
| Input Validation / Mass Assignment | ✓ | [n] | |
| Rate Limiting / Abuse | ✓ | [n] | |
| Cryptography / Secrets | ✓ | [n] | |
| Race Conditions | ✓ | [n] | |

SHIPPING GATE
-------------
[ ] No Critical findings open
[ ] No High findings open
[ ] All Medium findings acknowledged and triaged
Verdict: CLEAR TO SHIP / BLOCKED

OPEN ITEMS
----------
[Findings awaiting fix, questions needing Architect or product input]
[Or: None]
```

---

## Quick Reference — Attack Category to Step

| You want to check for... | Go to step |
|--------------------------|-----------|
| Fraud, price manipulation, double-spend | Step 2 |
| SQL injection, XSS, command injection | Step 3 |
| Login bypass, token reuse, session flaws | Step 4 |
| IDOR, broken access control, privilege escalation | Step 5 |
| PII leak, verbose errors, exposed secrets | Step 6 |
| Mass assignment, missing validation | Step 7 |
| Brute force, enumeration, rate limit gaps | Step 8 |
| Weak hashing, hardcoded secrets, HTTP | Step 9 |
| Double-booking, race conditions, duplicate processing | Step 10 |
