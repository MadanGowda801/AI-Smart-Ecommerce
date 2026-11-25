# Production Deployment & Environment Setup Guide

This guide details the production deployment architecture, environment variable audit, security boundaries, and operational verification procedures for the **Smart E-Commerce Platform**.

---

## 1. Environment Variables Audit & Matrix

Every environment variable used by the application is cataloged below, classified by scope, sensitivity, and requirement.

> [!IMPORTANT]
> **Zero-Secret Rule in Frontend Bundles:**
> Variables prefixed with `VITE_` are statically embedded into client JavaScript bundles during `npm run build` and are visible to anyone inspecting network traffic or browser source code.
> **Never prefix secret keys (API keys, private keys, database passwords, webhook secrets) with `VITE_`.**

| Environment Variable | Scope | Classification | Required in Prod | Description & Usage | Example Format |
|---|---|---|---|---|---|
| `VITE_INSFORGE_URL` | Client (Browser) | **Public** | **Yes** | Base API URL of the InsForge backend instance. | `https://<subdomain>.insforge.app` |
| `VITE_INSFORGE_ANON_KEY` | Client (Browser) | **Public** | **Yes** | Public anonymous JWT key. Scoped strictly by PostgreSQL Row-Level Security (RLS). | `anon_<alphanumeric_token>` |
| `VITE_RAZORPAY_KEY_ID` | Client (Browser) | **Public** | **Yes** | Razorpay merchant key ID used to open the client checkout modal. | `rzp_live_<key_id>` (or `rzp_test_*`) |
| `INSFORGE_URL` | Server / Edge | **Public / Config** | **Yes** | Backend URL for server-side operations and RPC invocations. | `https://<subdomain>.insforge.app` |
| `INSFORGE_API_KEY` | Server / Edge | **Secret (Server-Only)** | **Yes** | Privileged service-role API key. Bypasses RLS to verify transactions and update order states. | `key_<service_api_key>` |
| `RAZORPAY_KEY_SECRET` | Server / Edge | **Secret (Server-Only)** | **Yes** | Merchant secret used exclusively for authoritative HMAC-SHA256 signature verification. | `<razorpay_secret_string>` |
| `PAYMENT_GATEWAY_MODE` | Server / Edge | **Server Config** | **Yes** | Gateway operation mode: `test` (sandbox) or `live` (production). When `live`, mock simulation is blocked (403). | `live` |
| `PORT` | Server / Runtime | **Server Config** | Optional | Port for the backend service (defaults to `5173`). | `5173` / `8080` |
| `NODE_ENV` | Server / Runtime | **Server Config** | Recommended | Node environment mode. | `production` |

---

## 2. Development vs. Production Configuration Separation

The platform enforces a clean boundary between local development and production environments:

### Local Development (`development`)
- Uses local environment file `.env.local` (ignored in `.gitignore`).
- `PAYMENT_GATEWAY_MODE=test` enabling sandbox testing and developer signature simulations.
- Vite dev server runs with middleware plugin handling `/api/payments/*` routes.
- Development fallback constants in `src/config/env.js` ensure safe local boot without crashing dev tooling.

### Production Environment (`production`)
- Environment variables are injected via the hosting platform's dashboard or CI/CD secrets manager (Vercel, Netlify, AWS Secrets Manager, Docker compose).
- `PAYMENT_GATEWAY_MODE=live` automatically disables simulated signature endpoints (`/api/payments/simulate-signature` returns `403 Forbidden`).
- `src/config/env.js` guards against missing variables with explicit runtime and build warnings.
- Server-side payment verification enforces timing-safe HMAC-SHA256 cryptographic verification using `crypto.timingSafeEqual`.
- Prices and order totals are authoritatively fetched from PostgreSQL (`orders.total_amount`); client-supplied amounts are never trusted.

---

## 3. Security Architecture & Controls

### Client-Side Security Guard
`src/config/env.js` contains an automated runtime scanner that inspects `import.meta.env` keys. If any variable containing `SECRET`, `PRIVATE_KEY`, `API_KEY`, `PASSWORD`, or `TOKEN` is exposed without being an intended public anon key, the client throws a critical security error and refuses to run in production.

### Server-Side Payment Verification Boundary
- `server/paymentGatewayPlugin.js` isolates `RAZORPAY_KEY_SECRET` and `INSFORGE_API_KEY`.
- No client component has direct access to payment secrets.
- Orders can only transition to `payment_confirmed` / `paid` via server-side verification through PostgreSQL RPC functions (`mark_order_paid`).

### Row Level Security (RLS)
- Frontend queries run using the anonymous public key (`VITE_INSFORGE_ANON_KEY`).
- PostgreSQL RLS policies restrict order viewing, profile updates, and cart operations to the authenticated user ID (`auth.uid()`).
- Catalog products are publicly readable but only writable by administrators.

### Safe Storage Rules
- Image uploads in `src/services/storageService.js` are validated for size (max 5 MB) and MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`).
- Only file URLs and storage keys are persisted in the database; binary blobs are never stored directly in SQL rows.

---

## 4. Verification Checklists

### 4.1 Production Build Verification
The production build compiles standard, tree-shaken, and minified assets:
```bash
npm run build
```
Build verification checks:
- Standard bundle outputs to `dist/`.
- Chunk sizes optimized (vendor chunks split into `vendor-react`, `vendor-icons`, `vendor-insforge`).
- Zero secret strings embedded in bundle assets.

### 4.2 Database Configuration Check
- Postgres instance running on InsForge.
- Essential tables verified: `products`, `categories`, `orders`, `order_items`, `cart_items`, `wishlist`, `reviews`, `user_activity`, `payments`, `payment_events`, `notifications`.
- Authenticated and anonymous access policies enforced by RLS.

### 4.3 Storage Configuration Check
- InsForge storage bucket `product-images` configured.
- Public read access enabled for product imagery CDN URLs.
- Admin upload policies configured.

### 4.4 Authentication Configuration Check
- InsForge Auth active with email/password authentication.
- Session verification endpoint active.
- Password hashing handled securely by InsForge BaaS.

### 4.5 Payment Gateway Configuration Check
- Razorpay credentials segregated: `VITE_RAZORPAY_KEY_ID` (public) vs `RAZORPAY_KEY_SECRET` (server).
- `/api/payments/config` endpoint verifies public configuration delivery without secrets.
- Live mode enforcement prohibits sandbox mock signatures.

### 4.6 AI Configuration Check
- Conversational Shopping Assistant (`aiChatService.js`) and Personalized Recommendation Engine (`recommendationService.js`) operate safely without client-side API keys.
- Real-time catalog queries, multi-signal scoring, and cold-start algorithms run securely against the database.

---

## 5. Deployment Guide

### Option A: Static Hosting + Serverless Functions (Vercel / Netlify)

1. **Connect Repository:**
   Connect your Git repository to Vercel or Netlify.
2. **Build Settings:**
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Configure Environment Variables:**
   Add the following in project settings:
   - `VITE_INSFORGE_URL`
   - `VITE_INSFORGE_ANON_KEY`
   - `VITE_RAZORPAY_KEY_ID`
   - `INSFORGE_URL`
   - `INSFORGE_API_KEY`
   - `RAZORPAY_KEY_SECRET`
   - `PAYMENT_GATEWAY_MODE=live`
4. **Deploy:**
   Trigger the production deployment and verify that the public URL loads correctly.

### Option B: Node.js Container / VPS (Docker / PM2)

1. **Build the production bundle:**
   ```bash
   npm ci
   npm run build
   ```
2. **Preview / Production Server:**
   ```bash
   npm run preview -- --host 0.0.0.0 --port 5173
   ```
3. **Environment Setup:**
   Ensure environment variables are provided via Docker environment or `.env.production.local` (never committed to git).

---

## 6. Pre-Flight Production Checklist

- [x] Environment variable audit completed.
- [x] `.env.example` created with sanitized placeholders and no real secrets.
- [x] `.gitignore` verified to exclude all `.env*` secret files and build artifacts.
- [x] Client environment guard active against secret leakage.
- [x] `paymentGatewayPlugin.js` enforces server-side HMAC validation and live mode restrictions.
- [x] Database queries and tables verified.
- [x] Storage bucket and public URL generation verified.
- [x] Authentication methods and session verification verified.
- [x] Payment endpoints tested and verified.
- [x] AI chat and recommendation pipelines operational.
- [x] Production build passes cleanly with zero errors (`npm run build`).
