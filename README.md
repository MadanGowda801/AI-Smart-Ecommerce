# AuraStore — Smart E-Commerce Platform

An intelligent, next-generation e-commerce web application engineered for the **Smart E-Commerce Major Project**. Powered by a modern **React 19 + Vite 6** frontend with a custom **Vanilla CSS** design system and backed by **InsForge** (Postgres-based BaaS with built-in Auth, Storage, Edge Functions, Realtime, and OpenRouter AI Model Gateway).

---

## Project Overview & Modules

This project satisfies all required academic and production-grade specifications for the Smart E-Commerce system:

1. **Customer E-Commerce Storefront:** Modern, responsive UI with deep-space glassmorphic aesthetic.
2. **Product Catalog & Categories:** Hierarchical product browsing, attributes, categories, and inventory.
3. **Multi-Faceted Search & Filtering:** Dynamic keyword filtering, price thresholds, ratings, and instant sorting.
4. **User Registration & Login (InsForge Auth):** Email verification, passwordless OTP, and session management.
5. **User Profile & Addresses:** Account settings, order history, and saved shipping destinations.
6. **Persistent Shopping Cart & Wishlist:** Real-time quantity adjustments, cart totals, and local/cloud persistence.
7. **Checkout & Payment Records:** Multi-stage checkout process integrated with InsForge payment records (Stripe / Razorpay).
8. **Order Management & Real-Time Tracking:** Order status lifecycles (`pending` → `processing` → `shipped` → `delivered`).
9. **Automated Notifications:** Built-in email delivery (signup, receipts) and in-app status updates.
10. **Product Reviews & Ratings:** Verified buyer reviews, star ratings, and community feedback.
11. **AI-Based Personalized Recommendations:** Smart product affinities and recommendations via OpenRouter AI.
12. **AI Shopping Chatbot:** Conversational shopping assistant widget providing instant product discovery and sizing advice.
13. **Voice Shopping Assistant Interface:** Hands-free voice navigation, voice search, and voice cart commands.
14. **Admin Dashboard & Inventory Suite:** Back-office management for product catalogs, stock levels, and sales analytics.

---

## Architecture & Technology Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend Framework** | React 19 + Vite 6 | Lightning-fast HMR and optimized production bundles |
| **Styling** | Vanilla CSS (CSS Variables) | Premium custom design system, glassmorphism, responsive tokens |
| **Backend as a Service (BaaS)** | [InsForge](https://insforge.dev) | Cloud Postgres database, Row Level Security (RLS), edge APIs |
| **SDK Integration** | `@insforge/sdk` (v1.5.2) | Official client-side library for database, auth, and storage |
| **CLI & Infrastructure** | `@insforge/cli` | Schema migrations, secrets management, diagnostics, and deployment |
| **AI Gateway** | OpenRouter via InsForge | LLM models for shopping chatbot and personalized recommendations |
| **Icons** | `lucide-react` | Clean, modern iconography |

---

## Directory Structure

```text
smart e-commerce major pj/
├── .agents/
│   └── skills/                 # Official InsForge agent skills
│       ├── insforge/           # App code with @insforge/sdk
│       ├── insforge-cli/       # CLI operations, migrations, backups
│       ├── insforge-debug/     # Diagnostics & troubleshooting
│       ├── insforge-integrations/ # Third-party auth & payment integrations
│       └── find-skills/        # Skill discovery utility
├── .insforge/
│   └── project.json            # Linked InsForge project credentials
├── public/
│   └── favicon.svg             # Modern branded SVG favicon
├── scripts/
│   └── validate-setup.js       # Automated health check & connection test
├── src/
│   ├── assets/                 # Static media and graphics
│   ├── components/
│   │   ├── common/             # Reusable UI (Navbar, Footer)
│   │   └── features/           # Specialized modules (HeroBanner, StatusBadge, Chatbot, Voice)
│   ├── config/
│   │   └── env.js              # Strict env-var parsing & secret-leak prevention
│   ├── context/
│   │   ├── AuthContext.jsx     # InsForge auth session management
│   │   └── CartContext.jsx     # Shopping cart state provider
│   ├── lib/
│   │   └── insforge.js         # Official @insforge/sdk client instance
│   ├── pages/
│   │   ├── HomePage.jsx        # Landing overview & architecture status
│   │   ├── CatalogPage.jsx     # Product grid, search, & category filter
│   │   └── AdminDashboardPage.jsx # Inventory & sales analytics console
│   ├── services/
│   │   ├── authService.js      # Auth methods wrapper
│   │   ├── productsService.js  # Database queries for products & categories
│   │   ├── ordersService.js    # Database queries for orders & order items
│   │   └── aiChatService.js    # AI assistant & voice speech processing
│   ├── styles/
│   │   ├── main.css            # Design tokens, reset, typography, cards
│   │   ├── components.css      # Navigation, badges, panels, triggers
│   │   └── animations.css      # Keyframes & micro-interactions
│   ├── App.jsx                 # Root component with routing tabs & modals
│   └── main.jsx                # DOM mounting
├── .env.example                # Sanitized template for environment variables
├── .env.local                  # Local secrets & public credentials (git-ignored)
├── .gitignore                  # Git exclusions (.env, node_modules, .insforge)
├── AGENTS.md                   # AI Coding Agent guidance & backend rules
├── index.html                  # HTML entry point with Google Fonts & SEO
├── package.json                # Project dependencies & scripts
├── README.md                   # Documentation
└── vite.config.js              # Vite configuration
```

---

## Security & Environment Handling

Client-side code operates under strict zero-trust principles:

1. **Public Anon Key Only:** The browser application exclusively receives `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY`. All database queries are guarded by Postgres Row-Level Security (RLS).
2. **Server-Side Admin Isolation:** The `INSFORGE_API_KEY` (admin role) is **NEVER** prefixed with `VITE_` and is never included in the browser bundle.
3. **Audited Environment Module:** [`src/config/env.js`](file:///c:/Users/User/Desktop/smart%20e-commerce%20major%20pj/src/config/env.js) validates public keys at runtime and logs a console alert if any secret variable is inadvertently exposed.

### Environment Files

- [`.env.local`](file:///c:/Users/User/Desktop/smart%20e-commerce%20major%20pj/.env.local) (Active credentials, not committed to git):
  ```bash
  # InsForge BaaS Connection
  INSFORGE_URL=https://wheg6hgs.ap-southeast.insforge.app
  INSFORGE_ANON_KEY=anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9
  INSFORGE_API_KEY=ik_a2de48b18b3a58249b5729b298031d9b

  # Client Framework Public Keys (Safe for browser)
  VITE_INSFORGE_URL=https://wheg6hgs.ap-southeast.insforge.app
  VITE_INSFORGE_ANON_KEY=anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9
  ```
- [`.env.example`](file:///c:/Users/User/Desktop/smart%20e-commerce%20major%20pj/.env.example) (Clean reference template).

---

## Commands to Run the Application

### 1. Run Development Server
Starts the Vite local development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Run Setup Validation & Health Check
Validates all framework files, InsForge skills, project linking, secret isolation, and live BaaS ping:
```bash
npm run validate
```

### 3. Build for Production
Compiles and bundles the application to the `dist/` directory:
```bash
npm run build
```

### 4. Preview Production Build
Locally preview the optimized production build:
```bash
npm run preview
```

---

## InsForge Backend Commands (CLI)

The project is linked to InsForge project `c0ed3eee-44c9-4e2a-bef1-1fce09c4f073`. You can manage backend infrastructure directly using `npx @insforge/cli`:

- **Check Current Connection Context:**
  ```bash
  npx @insforge/cli current
  ```
- **Inspect Backend Metadata (Auth, DB, Buckets, Functions):**
  ```bash
  npx @insforge/cli metadata
  ```
- **Execute SQL or Inspect Database:**
  ```bash
  npx @insforge/cli db query "SELECT * FROM information_schema.tables WHERE table_schema = 'public';"
  ```
- **Run Backend Diagnostics:**
  ```bash
  npx @insforge/cli diagnose
  ```
- **Configure OpenRouter AI Gateway:**
  ```bash
  npx @insforge/cli ai setup
  ```
- **List Secrets & Environment Keys:**
  ```bash
  npx @insforge/cli secrets list
  ```

---

## AI-Based Product Recommendation Engine

AuraStore includes a multi-signal, behavior-driven recommendation engine backed by the InsForge `user_activity` and `recommendations` tables. The engine analyzes real-time user behavior to compute dynamic recommendation scores and generates explainable reasons.

### 1. Tracked User Activities

The engine logs 8 authenticated interaction types into the PostgreSQL `user_activity` table:

| Activity Type | Description | Weight in Engine |
|---|---|:---:|
| `product_view` | User opens a product details page | 2 |
| `category_view` | User views or filters a specific category | 2 |
| `search` | User performs a keyword search query | 4 |
| `product_click` | User clicks a product card to inspect hardware | 3 |
| `add_to_cart` | User adds a product to their shopping cart | 10 |
| `wishlist_add` | User saves an item to their personal wishlist | 8 |
| `purchase` | User completes an order checkout containing the item | 15 |
| `product_rating` | User writes a review and submits a star rating | 6 |

Activities are deduplicated in-memory (5-second throttle window) to prevent spamming from rapid re-renders.

---

### 2. Recommendation Scoring System

Every catalog product is scored across **9 core signals**:

1. **Category Preference ($s_{cat}$, 30% Weight):** Measures user affinity for the product's category based on historical activity counts and actions:
   $$s_{cat} = \frac{\text{CategoryWeight}(p)}{\max_{c} \text{CategoryWeight}(c)}$$

2. **Search Terms Relevance ($s_{search}$, 20% Weight):** Tokenized match between the product's name, brand, category, and description against the user's recent search queries:
   $$s_{search} = \max_{t \in \text{searches}} \left( \frac{|\text{Tokens}(t) \cap \text{Tokens}(p)|}{|\text{Tokens}(t)|} \right)$$

3. **Product Interactions ($s_{interact}$, 15% Weight):** Direct views, clicks, and brand browsing affinity (+0.5 for direct interaction, up to +0.5 for brand preference).

4. **Cart & Wishlist History ($s_{intent}$, 15% Weight):** High-intent indicators: +0.6 for cart items, +0.4 for wishlist items.

5. **Purchase History ($s_{purch}$, 10% Weight):** Affinity for previously ordered categories and brands (+0.6 for purchased category, +0.4 for purchased item).

6. **Product Rating & Popularity ($s_{qual}$, 10% Weight):**
   $$s_{qual} = 0.6 \times \left(\frac{\text{Rating}}{5.0}\right) + 0.4 \times \min\left(1.0, \frac{\text{ReviewsCount} \times 1.5 + (\text{isFeatured} ? 50 : 0)}{250}\right)$$

7. **Product Availability (Filter Gate):** Strict filter: only products with $\text{Stock} > 0$ qualify for recommendation.

#### Composite Score Formula:

$$\text{FinalScore} = \text{clamp}\Big(0.12, 0.9999, \big(0.30 \cdot s_{cat} + 0.20 \cdot s_{search} + 0.15 \cdot s_{interact} + 0.15 \cdot s_{intent} + 0.10 \cdot s_{purch} + 0.10 \cdot s_{qual} + \text{FeaturedBoost}\big)\Big)$$

Scores are rounded to 4 decimal places and displayed to customers as **Match Percentages** (e.g., 87% Match).

---

### 3. Explainable Recommendation Reasons

Rather than opaque rankings, every recommended product includes human-readable rationale:

- `"Because you viewed Electronics"` / `"Because you viewed Audio & Headphones"`
- `"Based on your recent searches"`
- `"Similar to products you purchased"`
- `"Popular in your favorite category"`
- `"Pairs well with items in your cart"`
- `"Highly rated customer favorite (★ 4.9)"`

---

### 4. Recommendation Sections

The engine provides 5 distinct sections:

1. **Recommended For You:** Top overall personalized composite scores.
2. **Because You Viewed:** Handpicked items from departments the user browsed.
3. **Based on Your Searches:** Items matching keyword intent with confirmed inventory.
4. **Similar Products:** Hardware alternatives in the same category and price tier.
5. **Popular Products:** Trending items nationwide based on ratings and review counts.

---

### 5. Cold-Start Strategy

For new users or guests without browsing history:
- Generates high-confidence picks based on **product rating quality**, **review velocity**, and **featured status**.
- Enforces **category diversity** across the top picks so visitors see a balanced catalog rather than a single department.
- Automatically transitions to personalized scoring as soon as the first interaction is recorded.

---

### 6. Caching & Persistence

- **In-Memory Cache:** 30-second TTL to avoid duplicate database queries during rapid page navigation.
- **Cache Invalidation:** Instantly cleared whenever a new tracking activity occurs (`add_to_cart`, `search`, `purchase`, `view`).
- **Database Persistence:** Top recommendations are asynchronously saved to the InsForge `recommendations` table for analytics and audit trails.

---

### 7. Running the Test Scenario

To verify the recommendation engine and observe scores change after user activity:

```bash
node scripts/test-recommendation-scenario.js
```

---

## Payment Gateway Integration & Sandbox Testing Guide

The Smart E-Commerce Platform features an end-to-end payment gateway integration adhering to the official **Razorpay Standard Checkout** workflow and zero-trust security architecture.

### 1. Key Locations & Configuration

| Key / Config | Purpose | Placement | Client Exposure |
|---|---|---|---|
| `VITE_RAZORPAY_KEY_ID` | Public Key Identifier | `.env` / `.env.local` / CI | **SAFE** (Accessible via `import.meta.env.VITE_RAZORPAY_KEY_ID`) |
| `RAZORPAY_KEY_SECRET` | Cryptographic HMAC Secret Key | `.env` / `.env.local` / Server Process | **STRICTLY SERVER-ONLY** (Never in Vite bundle) |
| `PAYMENT_GATEWAY_MODE` | Gateway mode (`test` or `live`) | `.env` / `.env.local` | Server & Client |
| `INSFORGE_URL` | BaaS Database Endpoint | `.env` / `.env.local` | Server & Client |
| `INSFORGE_API_KEY` | Admin / Service Role Key | `.env` / `.env.local` | **SERVER-ONLY** (Never exposed to client) |

> 🔒 **Security Guarantee**: The secret key (`RAZORPAY_KEY_SECRET`) is never bundled into client JavaScript. It is stored exclusively in server environment variables and processed inside the backend middleware (`server/paymentGatewayPlugin.js`).

---

### 2. Required Environment Variables

Add the following to `.env.local` (local development) or cloud server configuration:

```env
# InsForge Configuration
INSFORGE_URL=https://wheg6hgs.ap-southeast.insforge.app
INSFORGE_ANON_KEY=anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9
INSFORGE_API_KEY=ik_a2de48b18b3a58249b5729b298031d9b

# Client Framework Public Keys
VITE_INSFORGE_URL=https://wheg6hgs.ap-southeast.insforge.app
VITE_INSFORGE_ANON_KEY=anon_1f344ff00d148a22234c12c3f5616df77fc3c01286d1f4a3aac7fd0fab6649a9

# Payment Gateway Configuration (Test / Sandbox Mode)
# Public Key (Safe for frontend exposure)
VITE_RAZORPAY_KEY_ID=rzp_test_smartshopdev2026

# Secret Key (SERVER-SIDE ONLY - NEVER EXPOSE TO FRONTEND)
RAZORPAY_KEY_SECRET=sec_test_smartshopsecret2026

# Gateway Mode (test | live)
PAYMENT_GATEWAY_MODE=test
```

---

### 3. Payment Lifecycle & Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Checkout as Checkout UI
    participant Backend as Vite Dev Server (/api/payments)
    participant Database as InsForge Postgres DB

    Customer->>Checkout: Place Order (UPI / Card / NetBanking)
    Checkout->>Database: createOrder() [status: placed, payment_status: pending]
    Checkout->>Backend: POST /api/payments/create-order
    Backend->>Database: insert/update payments [status: pending] & payment_events [initiated]
    Backend-->>Checkout: Return razorpayOrderId, amount, keyId
    Checkout->>Customer: Display Razorpay Modal (Sandbox / Checkout.js)

    alt Customer Approves Payment
        Customer->>Checkout: Submit valid UPI / Card
        Checkout->>Backend: POST /api/payments/verify-payment (orderId, payId, sig)
        Backend->>Backend: verifyRazorpaySignature() [HMAC-SHA256 timing-safe]
        alt Signature Valid
            Backend->>Database: Update payments [paid, txn_ref], orders [paid], payment_events [verified]
            Backend->>Database: Insert notification for user
            Backend-->>Checkout: Return { verified: true, paymentStatus: 'paid' }
            Checkout->>Customer: Clear cart & Navigate to Order Confirmation
        else Signature Invalid / Tampered
            Backend->>Database: payment_events [failed: SIGNATURE_MISMATCH]
            Backend-->>Checkout: 400 Bad Request { verified: false }
            Checkout->>Customer: Display Verification Error & Retry Button
        end
    else Customer Simulates Decline / Bank Error
        Customer->>Checkout: Trigger Failure
        Checkout->>Backend: POST /api/payments/record-failure
        Backend->>Database: Update payments [failed], orders [failed], payment_events [failed]
        Backend->>Database: Insert failure notification
        Backend-->>Checkout: Return { recorded: true, canRetry: true }
        Checkout->>Customer: Show Failure Reason & Retry Payment button
    else Customer Dismisses / Cancels
        Customer->>Checkout: Click Cancel / Close
        Checkout->>Backend: POST /api/payments/cancel
        Backend->>Database: Update payments [cancelled], payment_events [cancelled]
        Checkout->>Customer: Order remains pending & retryable
    end
```

---

### 4. How to Test Payments in Development (No Real Money)

#### A. Testing a Successful Payment
1. Add any item to your cart and proceed to Checkout (`#/checkout`).
2. Complete Step 1 (Address) and Step 2 (Shipping).
3. In Step 3 (Payment), select **UPI** or **Credit / Debit Card**.
4. In Step 4 (Review), click **Proceed to Pay**.
5. When the Razorpay Sandbox Modal opens:
   - **UPI Method:** Ensure the VPA is set to `success@razorpay` (or click `✓ success@razorpay`).
   - **Card Method:** Use pre-filled test card `4111 1111 1111 1111`, expiry `12/28`, CVV `123`.
   - Click **Pay ₹Amount (Simulate Approval)**.
6. **Expected Result:**
   - The modal communicates with `/api/payments/verify-payment`.
   - Server validates the HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
   - Cart is automatically cleared.
   - Order confirmation receipt opens showing:
     - Badge: **PAID**
     - Logistics tracking number & courier partner
     - **Transaction Reference:** `pay_...`
     - Notification created in user account.

#### B. Testing a Failed Payment
1. In the Razorpay Sandbox Modal:
   - Click the red **Simulate Failure** button, OR:
   - Select UPI and click `✗ failure@razorpay`, OR:
   - Select Card and click `✗ Declined Card` (`4000 0000 0000 0002`).
2. **Expected Result:**
   - Server updates the order and payment records to `payment_status = 'failed'` with failure reason.
   - Audit event `failed` is saved in `payment_events`.
   - Checkout displays a prominent **Payment Action Required** card showing the decline description.
   - Order remains alive and shows:
     - 🔄 **Retry Payment:** Clicking this re-initiates the gateway for the exact same order without duplicate order creation.
     - 💳 **Change Method:** Switch to COD or another card.

#### C. Testing Payment Cancellation
1. In the Razorpay Sandbox Modal, click **Cancel / Dismiss**.
2. **Expected Result:**
   - Server logs `cancelled` in `payment_events` and sets `payments.payment_status = 'cancelled'`.
   - Checkout informs the user that payment was dismissed and offers instant retry.

---

### 5. Running the Automated Test Suite

A dedicated end-to-end integration test verifies all 10 payment gateway requirements:

```bash
node scripts/test-payment-gateway-flow.js
```

**Test Suite Coverage:**
- [1/10] Public vs secret key separation & leak prevention
- [2/10] Gateway public config endpoint
- [3/10] Authenticated customer session
- [4/10] Order creation with initial status `pending` (anti-fraud)
- [5/10] Payment initiation & `payment_events` audit table entry
- [6/10] Payment cancellation recording
- [7/10] Payment failure recording & failure notification
- [8/10] Anti-tampering check: rejection of forged signatures (400 Bad Request)
- [9/10] Cryptographic HMAC-SHA256 signature verification, order status update to `paid`, and `transaction_reference` persistence
- [10/10] Authoritative payment status polling endpoint

---

## Current Status & Next Steps

✅ **All Core Modules Implemented & Verified:**
- Complete DB-backed catalog, categories, search, filtering, and pagination.
- Real shopping cart and wishlist with InsForge cloud sync.
- Complete checkout flow: saved address book, order creation, order tracking.
- AI-based recommendation engine with 9 scoring signals, 5 sections, explainable reasons, and cold-start fallback.
- **Payment Gateway Integration:** Razorpay Sandbox support, server-side HMAC-SHA256 verification, anti-tampering protection, immutable `payment_events` audit trail, automated user notifications, live transaction reference display, and failed payment retry mechanisms.

