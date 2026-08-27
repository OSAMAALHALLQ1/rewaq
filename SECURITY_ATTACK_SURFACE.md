# 🛡️ REWAQ SAAS — COMPLETE SECURITY ATTACK SURFACE MAP

**Document Status:** Complete & Audited  
**Baseline Date:** August 2026  
**System Architecture:** Multi-Tenant Restaurant Management SaaS (Next.js 16.2 / React 19 / Supabase / PostgreSQL)

---

## 1. Executive Surface Summary

| Surface Domain | Total Endpoints / Components | Public Facing | Authenticated / Protected |
| :--- | :--- | :--- | :--- |
| **Public UI Pages** | 8 Pages | 8 (`/`, `/login`, `/register`, `/forgot-password`, `/m/[slug]`, `/r/[token]`, `/pricing`, `/request-demo`) | 0 |
| **Authenticated UI Pages** | 79 Pages | 0 | 79 (`/dashboard/*`, `/d/*`, `/admin/*`) |
| **API Route Handlers** | 29 Routes (38 HTTP Handlers) | 3 (`/api/admin-auth`, `/api/auth/department-login`, `/api/search`) | 26 Routes (Role / Device Protected) |
| **Server Actions** | 56 Actions across 11 Files | 4 (`requestDemoAction`, `loginAction`, `registerAction`, `forgotPasswordAction`) | 52 Actions |
| **Database Tables** | 54 Tables | 0 (All Protected by RLS) | 54 Tables |
| **Database Views** | 1 View (`order_details_view`) | 0 | 1 View |
| **Database Functions / RPCs** | 41 Functions | 0 (27 SECURITY DEFINER) | 41 Functions |
| **Browser Storage Keys** | 8 Storage Types | Client-side only | Tenant Partitioned |

---

## 2. Detailed Attack Surface Breakdown

### 2.1 Public Attack Surface (Unauthenticated Access)

```
+-----------------------------------------------------------------------------------------+
|                                  PUBLIC ENTRY POINTS                                    |
+-----------------------------------------------------------------------------------------+
| 1. Landing & Marketing:        GET /                                                    |
| 2. Customer Digital Menu:      GET /m/[slug]                                            |
| 3. Customer Public Receipts:   GET /r/[token], GET /r/[token]/image                     |
|                                GET /r/customer-invoices/[id] (Public preview)          |
| 4. User Registration:          GET /register, POST Server Action registerAction         |
| 5. User Authentication:        GET /login, POST Server Action loginAction               |
|                                POST Server Action startDemoSessionAction                |
| 6. Password Reset:             GET /forgot-password, forgotPasswordAction               |
| 7. Department Device Login:    POST /api/auth/department-login (PIN & Device Key)       |
| 8. Demo Request:               GET /request-demo, POST requestDemoAction                |
+-----------------------------------------------------------------------------------------+
```

#### Specific Threat Vectors on Public Surface:
* **Token Guessing / Enumeration on Receipts (`/r/[token]`):** Attackers attempting to guess invoice UUIDs or random receipt tokens to view other tenants' order details.
* **Brute-Force & Credential Stuffing on Login (`/login`, `/api/auth/department-login`):** Rapid automated PIN or password guessing attempts.
* **Customer Menu Information Disclosure (`/m/[slug]`):** Probing whether unlisted items, internal recipe costs, or inventory quantities leak through the public menu query.
* **Host Header Injection in Password Reset:** Tampering with `Host` or `X-Forwarded-Host` during password reset requests.

---

### 2.2 Authenticated Dashboard & Department Surface

```
+-----------------------------------------------------------------------------------------+
|                               AUTHENTICATED WEB SURFACE                                 |
+-----------------------------------------------------------------------------------------+
| 1. Main Management Dashboard:  /dashboard (Owner, Branch Manager, Accountant, Admin)   |
| 2. POS Cashier Terminal:       /d/pos (Cashier, Waiter, Manager, Owner)                 |
| 3. Waiter Ordering Screen:     /d/waiter (Waiter, Cashier, Manager, Owner)              |
| 4. Kitchen Display System:     /d/kitchen (Kitchen Chef, Expo, Manager, Owner)          |
| 5. Expo Order Assembly Screen: /d/expo (Checker, Expo, Kitchen, Manager, Owner)         |
| 6. Inventory & Warehouse App:  /d/inventory, /dashboard/inventory/*                     |
| 7. Accounting & Treasury:      /d/accounting, /dashboard/accounting/*                   |
| 8. Super Admin Portal:         /admin/* (Platform Super Admin only)                     |
+-----------------------------------------------------------------------------------------+
```

#### Specific Threat Vectors on Authenticated Surface:
* **Vertical Privilege Escalation:** Waiter or Kitchen staff attempting to access Accounting reports, close financial periods, create API keys, or invite team members.
* **Horizontal Tenant Hopping:** User of Restaurant A crafting HTTP requests with IDs belonging to Restaurant B (IDOR / BOLA).
* **Multi-Branch Isolation Bypass:** Cashier in Branch 1 creating orders or viewing stock in Branch 2 without branch permissions.

---

### 2.3 API Route Handlers Inventory

| Endpoint URL | HTTP Methods | Authentication / Authorization Required | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/admin-auth` | `POST` | Super Admin Credentials | Platform admin console authentication |
| `/api/auth/department-login` | `POST` | Device Key Header + Employee PIN | Department terminal pairing & login |
| `/api/auth/department-session` | `GET, DELETE` | Session Cookie | Check or terminate department session |
| `/api/department/pos/catalog` | `GET, POST` | Department POS Entitlement | Fetch POS items or create quick dish |
| `/api/department/pos/checkout`| `POST` | Department POS Entitlement | Process invoice & deduct stock |
| `/api/department/pos/hold` | `GET, POST, DELETE` | Department POS Entitlement | Save/retrieve suspended orders |
| `/api/department/pos/invoices`| `GET` | Department POS Entitlement | Retrieve recent sales invoices |
| `/api/department/pos/refund` | `POST` | Department POS Entitlement + Manager | Process refund & sales return |
| `/api/department/pos/settings`| `GET, POST` | Department POS Entitlement | POS settings & receipt configuration |
| `/api/department/pos/shift` | `GET, POST` | Department POS Entitlement | Cash drawer shift open/close |
| `/api/department/kitchen/tickets` | `GET` | Kitchen / Expo Entitlement | Active kitchen ticket queues |
| `/api/department/kitchen/tickets/[id]` | `PATCH` | Kitchen / Expo Entitlement | Ticket item status updates |
| `/api/department/restaurant-orders` | `GET, POST` | POS / Waiter Entitlement | Restaurant order lifecycle & dispatch |
| `/api/department/restaurant-orders/[id]/status` | `PATCH` | POS / Waiter Entitlement | Order status transition |
| `/api/department/inventory/stock` | `GET` | Inventory / POS Entitlement | Real-time stock balance lookup |
| `/api/department-keys/create` | `POST` | Org Owner / Admin | Create device pairing API keys |
| `/api/department-keys/list` | `GET` | Org Owner / Admin | List active paired devices |
| `/api/department-keys/revoke` | `PATCH` | Org Owner / Admin | Revoke device access token |
| `/api/staff/create` | `POST` | Org Owner / Manager | Register new employee & PIN |
| `/api/staff/list` | `GET` | Org Owner / Manager | List employees & active roles |
| `/api/staff/toggle` | `PATCH` | Org Owner / Manager | Activate / Deactivate employee |
| `/api/internal-messages/list` | `GET` | Authenticated Staff Member | Internal staff messaging feed |
| `/api/internal-messages/send` | `POST` | Authenticated Staff Member | Broadcast internal staff alert |
| `/api/modifiers` | `GET, POST, PUT, DELETE` | Org Admin / Manager | Manage modifier groups & options |
| `/api/restaurant-workflow/setup` | `GET, POST` | Org Owner | Default restaurant setup wizard |
| `/api/search` | `GET` | Authenticated Member | Cross-module global search |

---

### 2.4 Server Actions Surface

The platform exposes **56 Server Actions** across 11 domain modules:
1. `src/server/actions/mutations.ts` (28 actions: Catalog, Menu, Recipes, POs, Invoices, Transfers, Waste, Returns, etc.)
2. `src/server/actions/auth.ts` (9 actions: Login, Register, Invite, Approvals, Password Reset, Demo)
3. `src/server/actions/accounting.ts` (3 actions: Journal entries, Chart of Accounts, Accounting Settings)
4. `src/server/actions/treasury.ts` (2 actions: Receipt & Payment Vouchers)
5. `src/server/actions/adjustments.ts` (1 action: Manual Stock Adjustments)
6. `src/server/actions/tables.ts` (5 actions: Table lifecycle, sessions, merging, status)
7. `src/server/actions/stock-counts.ts` (4 actions: Inventory audit counts and reconciliation)
8. `src/server/actions/team-access.ts` (3 actions: Employee access, PIN rotation, revocation)
9. `src/server/actions/digital-presence.ts` (2 actions: Website & menu settings)
10. `src/server/actions/billing.ts` (1 action: Subscription trial plan selection)
11. `src/server/actions/social.ts` (Deprecated / frozen)

---

### 2.5 Database Surface & RPCs

* **PostgreSQL Engine:** 54 Tables, 1 View, 41 Functions (27 `SECURITY DEFINER`).
* **Critical Atomic RPCs:**
  - `submit_restaurant_order_atomic`
  - `upsert_catalog_item_kitchen_route_atomic`
  - `post_balanced_journal_atomic`
  - `reverse_journal_entry_atomic`
  - `activate_recipe_version_atomic`
  - `issue_customer_invoice_atomic`
  - `get_next_invoice_number`
  - `is_accounting_period_closed`

---

### 2.6 Browser & Offline Storage Surface

* **IndexedDB (`rwq_offline_pos`):**
  - `invoice_queue`: Holds offline invoices pending sync.
  - `sync_log`: Holds sync transaction outcomes and conflict details.
* **LocalStorage:**
  - `rwq_receipt_design_{orgId}`: Receipt layout and metadata.
  - `rwq_last_user`: Last authenticated email (convenience).
* **Cookies:**
  - `sb-*-auth-token`: Supabase SSR JWT session token.
  - `rwq_dept_session`: Department device employee JWT session token.
  - `rwq_admin_session`: Platform admin session token.

---

### 2.7 Threat Actors & Capabilities

```
+---------------------+---------------------------------------------------------------+
| ACTOR PROFILE       | CAPABILITIES & GOALS                                          |
+---------------------+---------------------------------------------------------------+
| Attacker 1: Anon    | Probe public endpoints, brute-force PINs, guess receipt tokens|
| Attacker 2: Waiter  | Attempt privilege escalation to Accounting, close shifts, POs |
| Attacker 3: Cashier | Alter offline invoice totals/discounts, steal cash drawer data|
| Attacker 4: Owner A | Attempt IDOR against Owner B's recipes, costs, and customers  |
| Attacker 5: Revoked | Replay expired device token or old JWT to access branch data  |
+---------------------+---------------------------------------------------------------+
```
