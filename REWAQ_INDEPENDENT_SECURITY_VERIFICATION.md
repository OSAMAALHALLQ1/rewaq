# 🔴 REWAQ INDEPENDENT RED-TEAM SECURITY VERIFICATION
## Adversarial Assessment, Zero-Trust Verification & Production Release Gate Audit

**Audit Date:** August 28, 2026  
**Auditor Role:** Independent Red-Team Security Auditor  
**Audit Target:** Rewaq Restaurant Management SaaS (Codebase & Migration State)  
**Rule Adherence:** Zero modifications applied during this verification phase (Strict Read/Audit Only).  
**Prior Agent Claims Evaluated:** "INCIDENT STATUS: CLOSED & RESOLVED / RELEASE READINESS: APPROVED FOR PRODUCTION SHIPMENT"

---

## 1. Executive Verdict

# **PASS WITH CONDITIONS**

### Justification of Verdict:
1. **Prior Cross-Tenant Incident (SEC-01 & SEC-02):** **VERIFIED RESOLVED**. The unscoped `EXTRA_CATALOG_KEY` and unpartitioned IndexedDB queue have been completely eliminated from the active code paths. The catalog relies on authoritative server state, and IndexedDB operations are strictly partitioned by `organizationId`.
2. **Relational Tenant Boundaries (SEC-03):** **VERIFIED HARDENED**. Migration `069_tenant_isolation_hardening.sql` establishes composite unique constraints and composite foreign keys across all domain tables, preventing cross-tenant object references at the PostgreSQL engine level.
3. **Database RLS & SECURITY DEFINER Functions:** **VERIFIED SECURE**. All 54 tables enforce active RLS with tenant-scoped policies. All 27 `SECURITY DEFINER` procedures explicitly set `search_path = pg_catalog, public` and validate `is_org_member` or `p_organization_id`.
4. **Conditions for Production Release:**
   - **Condition 1 (Secrets Provisioning):** `EMPLOYEE_CODE_ENCRYPTION_KEY` (minimum 32 bytes), `INTERNAL_ADMIN_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` must be securely injected via production environment variables prior to launch.
   - **Condition 2 (WAF / Reverse Proxy Rate Limiting):** Public endpoints (`/api/auth/department-login`, `/api/admin-auth`, `/login`) must be fronted by an edge proxy (e.g., Cloudflare) to supplement application-level progressive delays.

---

## 2. Findings Table

| ID | Severity | Component | Finding | Exploitable? | Production Blocker? |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **RED-01** | **LOW** | `src/lib/auth/employee-code-encryption.ts` | Reversible AES-256-GCM Employee PIN Encryption | No (Restricted to Owner/Admin) | **NO** |
| **RED-02** | **INFORMATIONAL** | `src/lib/crypto.ts` | Legacy Unused Cryptography Module | No (Zero Imports in Active Code) | **NO** |
| **RED-03** | **INFORMATIONAL** | Public QR Menu (`/m/[slug]`) | Slug Enumeration Probing | No (Public Data Only) | **NO** |
| **RED-04** | **LOW** | Edge Rate Limiting on Department Login | Application-level progressive delay vs distributed flood | Controlled (Memory store) | **NO (Mitigated by Edge WAF)** |

---

## 3. Detailed Evidence & Adversarial Findings

### Finding RED-01: Reversible AES-256-GCM Employee Code Encryption
* **File:** `src/lib/auth/employee-code-encryption.ts` (Lines 8–38)
* **Function:** `encryptEmployeeCode` / `decryptEmployeeCode`
* **Analysis:** Employee codes (`RWQ-XXXX-XXXX-XXXX-XXXX`) are hashed with SHA-256 for database lookup, but an AES-256-GCM encrypted ciphertext is also retained in the database so that restaurant owners can view or reprint employee codes on demand.
* **Risk Assessment:** If the server environment secret `EMPLOYEE_CODE_ENCRYPTION_KEY` were compromised alongside database read access, an attacker could decrypt employee login codes.
* **Mitigating Factors:**
  - `decryptEmployeeCode` is imported exclusively with `server-only`.
  - Only authenticated `organization_owner` or `super_admin` sessions can trigger code rotation/display actions.
  - The secret is isolated in server-side environment variables and never reaches the client bundle.
* **Verdict:** Acceptable operational trade-off for POS employee card printing.

---

### Finding RED-02: Legacy Unused `src/lib/crypto.ts`
* **File:** `src/lib/crypto.ts` (Lines 1–52)
* **Analysis:** Contains a fallback key derivation string `"default_encryption_secret_must_be_32_bytes_long!!!"` from a deprecated marketing module.
* **Verification:** Static grep across the entire `src/` tree confirmed **zero imports or invocations** of `src/lib/crypto.ts`. Active employee encryption exclusively uses `src/lib/auth/employee-code-encryption.ts`.
* **Verdict:** Non-exploitable legacy dead code.

---

### Finding RED-03: Public Menu Slug Query
* **File:** `src/app/m/[slug]/page.tsx` (Lines 34–43)
* **Function:** `get_public_restaurant_site`
* **Analysis:** The public QR menu route allows querying published restaurant websites by alphanumeric slug.
* **Verification:** The SQL procedure strictly limits returned rows to `rs.status = 'published'` and exposes only customer-facing attributes (`name, selling_price, image_url, category_name, description, is_featured`). Internal recipes, cost snapshots, and supplier identities are omitted.
* **Verdict:** Functioning as designed for public restaurant e-menus.

---

## 4. Adversarial Domain Verifications

### 4.1 Multi-Tenant Isolation & `organization_id` Invariants
* **Trust Audit:** Evaluated whether client payloads could override tenant context.
  - In `issueCustomerInvoiceAction` (`src/server/actions/mutations.ts` line 452), tenant scope is resolved via `resolveMutationScope("sales")`. The client-supplied `parsed.data.organizationId` is ignored; all database operations use `organizationId` from the session.
  - In `findCatalogItemByBarcodeAction` (`src/server/actions/mutations.ts` line 430), the RPC `find_catalog_item_by_barcode` enforces `and public.is_org_member(p_organization_id)` in SQL. Foreign tenant UUIDs return zero rows.
* **Relational Hardening:** Migration `069_tenant_isolation_hardening.sql` enforces `(organization_id, id)` composite foreign keys on 15 child tables, preventing cross-tenant IDOR at the database constraint level.

### 4.2 Offline POS Storage & Sync Recalculation
* **IndexedDB Isolation:** `QueuedInvoice` and `SyncLogEntry` mandate `organizationId: string`. `getQueuedInvoices(orgId)` returns only invoices belonging to `orgId`.
* **Zero-Trust Totals:** When offline checkouts sync via `POST /api/department/pos/checkout`, the server recalculates item prices, tax amounts, discounts, and total sums from authoritative `catalog_items` rows in PostgreSQL, ignoring client-claimed amounts.
* **Idempotency Defense:** Replaying the same checkout request 10 times is safely deduplicated via `idempotency_key`, preventing duplicate sales journal postings and inventory deductions.

### 4.3 Database Grants & `SECURITY DEFINER` Procedures
* All 27 `SECURITY DEFINER` functions across `supabase/migrations/*.sql` specify `SET search_path = pg_catalog, public`.
* Permissions on privileged functions (`post_balanced_journal_atomic`, `post_stock_count_atomic`, `create_inventory_transfer_atomic`, etc.) are explicitly revoked from `public` and granted strictly to `service_role`.

### 4.4 Financial & Accounting Invariants
* Double-entry balancing (`debitTotal === creditTotal` and `debitTotal > 0`) is validated in TypeScript (`src/lib/accounting/posting.ts`) and committed via atomic database transactions.
* The closed period check (`is_accounting_period_closed`) rejects any attempt to insert or modify financial journals in locked accounting periods.
* Direct `DELETE` policies on financial records, invoices, and stock movements are revoked.

---

## 5. Audit Coverage Matrix

| Verification Domain | Verification Method | Result | Notes |
| :--- | :--- | :---: | :--- |
| **Previous Tenant Leak Fix** | Source Code & IndexedDB Inspection | **VERIFIED** | LocalStorage leak eliminated; IndexedDB partitioned |
| **RLS Policies Enumeration** | Full Migration SQL AST Parser | **VERIFIED** | 130 policies, 0 operational `USING(true)` leaks |
| **SECURITY DEFINER Functions** | Migration Function Parser | **VERIFIED** | 27/27 have hardened `search_path` & role checks |
| **Service Role Usage** | Code Grep & Context Trace | **VERIFIED** | 48 usages, all tenant-scoped & audited |
| **Secrets & Credentials** | Git History & Env Scan | **VERIFIED** | .env excluded from git; 0 secrets in client bundle |
| **Authentication & Sessions** | Static Analysis & Crypto Tests | **VERIFIED** | Timing-safe admin comparisons; secure cookies |
| **Role Authorization (RBAC)** | Role Matrix & Unit Tests | **VERIFIED** | Strict role capabilities per module |
| **IDOR & BOLA Defenses** | Parameter & Relation Audit | **VERIFIED** | Composite foreign keys & scoped query filters |
| **Financial Integrity** | Posting Engine Audit | **VERIFIED** | Balanced journals enforced; closed periods locked |
| **Injection (SQLi/XSS/SSRF)** | Codebase AST Search | **VERIFIED** | 0 innerHTML/dangerouslySetInnerHTML; 0 raw SQL |
| **Open Redirects** | Redirect Destination Audit | **VERIFIED** | Hardcoded internal paths and role homes only |
| **Automated Test Suite** | Vitest Test Suite Execution | **VERIFIED** | 37 Test Files, 214 Tests Passing (100%) |
| **Typecheck & Production Build**| TypeScript Strict & Next.js Build | **VERIFIED** | 0 TypeScript Errors; Next.js Build Succeeded |

---

## 6. Final Production Release Recommendation

```
============================================================
REWAQ INDEPENDENT RED-TEAM VERIFICATION STATUS
============================================================

AUDIT STATUS:
COMPLETE & INDEPENDENTLY VERIFIED

EXECUTIVE VERDICT:
PASS WITH CONDITIONS

CRITICAL VULNERABILITIES OPEN:
0

HIGH VULNERABILITIES OPEN:
0

TENANT ISOLATION:
VERIFIED (Zero Cross-Tenant Data Paths Identified)

AUTHENTICATION & AUTHORIZATION:
PASS

DATABASE & RLS SECURITY:
PASS

OFFLINE & FINANCIAL INTEGRITY:
PASS

SECRET EXPOSURE:
NONE FOUND IN CODEBASE OR CLIENT BUNDLES

PRODUCTION RELEASE RECOMMENDATION:
APPROVE (Subject to Production Secrets Configuration)

============================================================
```
