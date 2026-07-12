# Admin Dashboard Research & Recommendation for Nouf-ex

> **Scope:** Synthesize concrete patterns from the world's leading e-commerce admin
> dashboards (Shopify, Amazon Seller Central, Adobe Commerce / Magento, WooCommerce,
> Alibaba) into a recommended IA, sidebar, KPI widgets, list-page patterns, and
> detail-page patterns for the **Nouf-ex** multi-vendor marketplace admin.
>
> **Sources:**
>
> - Shopify Help Center – `help.shopify.com/en/manual/shopify-admin`
> - Amazon Seller Central – `sellercentral.amazon.com/help/hub/reference/*`
> - Adobe Commerce Admin User Guides – `experienceleague.adobe.com/en/docs/commerce-admin`
> - WooCommerce Documentation – `woocommerce.com/documentation/woocommerce/`
> - Wikipedia entries for Shopify, Magento, WooCommerce, Alibaba (corroborating context)

---

## 1. Platform-by-platform analysis

### 1.1 Shopify Admin

**Sidebar groups (current production admin, ordered as they appear):**

| # | Group | Items |
|---|---|---|
| 1 | **Home** | Setup checklist, Today's tasks, Tip of the day |
| 2 | **Orders** | Drafts, Abandoned checkouts, All (with status tabs: Open, Unfulfilled, Unpaid, Fulfilled) |
| 3 | **Products** | All products, Inventory, Transfers, Purchase orders, Collections, Gift cards |
| 4 | **Customers** | All customers, Segments, Saved searches |
| 5 | **Analytics** | Dashboards, Reports, Live view, Finances |
| 6 | **Marketing** | Campaigns, Automations, Customer journeys, Templates |
| 7 | **Discounts** | Discount codes, Automatic discounts |
| 8 | **Apps** | App and sales channel marketplace (10,000+ apps) |
| 9 | **Sales channels** | Online Store, Shop App, Facebook, Instagram, TikTok, etc. |
| 10 | **Online Store** | Themes, Pages, Navigation, Domains, Blog posts |
| 11 | **Content** | Metaobjects, Files, Menus |
| 12 | **Settings** | General, Plan, Billing, Users & permissions, Payments, Checkout, Shipping & delivery, Taxes, Locations, Gift cards, Markets, Apps, Notifications, Customer accounts, Policies |

**Home dashboard widgets (Shopify Home page):**

1. Setup checklist (progress to launch)
2. Today's sales (gross / net, sessions, conversion)
3. Tasks & follow-ups (to-do items surfaced)
4. Recent orders list (with quick-fulfill / refund actions)
5. Top products / Top-selling SKUs
6. Sessions over time (live + 24h line chart)
7. Visitors in store (real-time counter)
8. Inventory alerts (low stock, out of stock)
9. App suggestions / cross-sell cards
10. Cash flow snapshot

**Customers page capabilities** (per Shopify help docs):

- Full-text search by name, email, phone, order #
- Filters: location, customer tag, amount spent, # orders, last order date
- Saved filters / Saved searches
- Bulk actions: send email, add tag, remove tag, merge duplicate, delete
- Per-row actions: impersonate (Login as customer), send invoice, view timeline
- Customer detail page: account info, addresses, order history, lifetime stats, marketing consent, timeline of events, risk score

**Orders page capabilities:**

- Filter by status (Authorized, Partially paid, Paid, Fulfilled, etc.)
- Filter by payment status, fulfillment status, risk level, fraud risk, channel
- Bulk actions: fulfill, capture payment, print, cancel, archive, add tag
- Order detail: line items with inventory locations, payment timeline, fulfillment timeline, refund flow, customer note, fraud analysis

**Common list-page patterns:** sticky search bar; persistent filter chips; saved filters; saved views; bulk-action toolbar that slides in when rows are selected; column chooser; export to CSV; pagination footer with row count.

---

### 1.2 Amazon Seller Central

**Performance dashboard widgets (seller home / Performance → Account Health):**

1. Sales snapshot today / this week / this month (with sparkline)
2. Units ordered
3. Sessions (mobile + desktop split)
4. Buy Box % (with alert if < 95%)
5. Order Defect Rate (ODR < 1% required)
6. Late Shipment Rate (LSR < 4%)
7. Pre-fulfillment cancel rate (< 2.5%)
8. Policy compliance scorecard
9. Customer Service Dissatisfaction Rate (CSDR)
10. Account Health Rating (Green / Yellow / Red)
11. Stranded inventory alert
12. Top-selling ASINs

**Account Health section structure:**

- **Customer Service Performance** (Order Defect Rate)
- **Policy Compliance** (Product authenticity, intellectual property, safety complaints)
- **Shipping Performance** (Late shipment rate, Pre-fulfillment cancel rate, Valid tracking rate, On-time delivery rate)
- **Product authenticity & safety**
- **Return complaints**

Each metric shows: current value, threshold, status (green/yellow/red), historical trend, ability to appeal.

**Sidebar (post-login Seller Central):**

| Group | Items |
|---|---|
| Home | Performance snapshot, What's new |
| Orders | Manage Orders, Order Reports, Upload Order related files |
| Inventory | Manage Inventory, Manage FBA Inventory, Inbound Shipments, Restock Inventory |
| Pricing | Manage Pricing, Pricing Health, Automate Pricing, Business Pricing |
| Advertising | Campaign Manager, Brand Analytics, Sponsored Products/Brands/Display |
| Reports | Business Reports, Brand Analytics, Advertising Reports, Tax Reports |
| Performance | Account Health, Voice of the Customer, Product Reviews, Feedback |
| B2B | Quote Manager, Business Pricing, Net Payment Terms |
| Growth | Explore programs (FBA New Selection, Vine, etc.) |
| Stores | Manage Stores |

---

### 1.3 Adobe Commerce / Magento Admin

The most information-dense reference. **Sidebar groups** (full menu):

| # | Group | Sub-items |
|---|---|---|
| 1 | **Dashboard** | (home – Life-time sales, Average Order Value, Last Orders, Top Search Terms, Bestsellers) |
| 2 | **Sales** | Operations: Orders, Invoices, Shipments, Credit Memos |
| 3 |  | Agreements |
| 4 | **Catalog** | Products, Categories, Attributes (sets, properties), Advanced Pricing |
| 5 | **Customers** | All Customers, Now Online, Customer Groups, Segments |
| 6 | **Marketing** | Promotions: Catalog Price Rules, Cart Price Rules (coupons) |
| 7 |  | Communications: Email Templates, Newsletter Templates, Newsletter Queue, Newsletter Subscribers |
| 8 |  | SEO: URL rewrites, Sitemap, Search Terms, Search Synonyms |
| 9 |  | User Content: Reviews, Pending Reviews |
| 10 |  | Visual Merchandiser (Cloud) |
| 11 | **Content** | Pages, Blocks, Widgets, Design (Themes, Schedule) |
| 12 | **Reports** | Business Intelligence (BI dashboards), Sales, Customers (set comparisons), Products (bestsellers/low stock/ordered), Statistics, Marketing (search terms, abandoned carts) |
| 13 | **Stocks** | (Inventory Management) Sources, Stocks, Inventory Reservations |
| 14 | **Stores** | Configuration (single biggest tree), Sales Channels, Taxes, Currency, Attributes (Customer/Product), Roles & Permissions |
| 15 | **System** | Data Transfer (Import/Export), Cache Management, Index Management, Manage ACL Roles, Web Services (REST/SOAP Integrations), Notifications, Encryption, Backups, Action Log (Audit), Variables, Custom Variables |

**Sales → Order workflow** (the canonical e-commerce flow):

> Order → Invoice (capture payment) → Shipment (create fulfillment) → Credit Memo (refund)

Each entity has its own grid + detail page with a status machine.

**Configuration hierarchy** is the deepest in the industry – `Stores → Configuration` exposes ~30 sections with 500+ fields grouped under General, Catalog, Customers, Sales, Sales Channels, Advanced.

**Catalog structure:** Products sit under a hierarchy of Web Sites → Stores → Store Views, allowing multi-brand or multi-region catalogs that share an underlying product database.

---

### 1.4 WooCommerce (WordPress Admin)

Sidebar lives inside the standard WordPress admin, so the sidebar groups differ visually (they sit inside `WooCommerce` top-level menu) but conceptually map as:

| Group | Items |
|---|---|
| WooCommerce → Home | Setup wizard, What's new |
| Analytics → Reports | Revenue, Orders, Customers, Stock, Taxes, Downloads, Coupons |
| Analytics → Settings | Register pages, Enable advanced filters |
| Orders | All orders, status tabs (Pending payment / Processing / On-hold / Completed / Cancelled / Refunded / Failed), Add order |
| Customers | All customers, Add new, Customer search |
| Marketing | Coupons, Email follow-ups, Automatewoo (extension) |
| Reports → Customers | Customers vs. guests, Customer list |
| Reports → Stock | Low in stock, out of stock, most stocked |
| Reports → Taxes | By code, by date |
| Products | All products, Add new, Categories, Tags, Attributes, Brands |
| Settings → General | Store address, currency, allowed countries |
| Settings → Products | Measurements, reviews, inventory |
| Settings → Shipping | Zones, methods, classes |
| Settings → Payments | Gateways, fraud protection |
| Settings → Accounts & Privacy | Guest checkout, account creation, GDPR |
| Settings → Emails | Notification templates |
| Settings → Advanced | REST API, webhooks, legacy API |

**Dashboard widgets** (documented by WooCommerce – see `woocommerce.com/document/dashboard-widgets/`):

1. **WooCommerce Setup** wizard card (until done)
2. **WooCommerce Status** widget (total net sales this month, top-selling product, grid of order statuses, stock statuses – low / out of stock)
3. **WooCommerce Recent Reviews** widget (avatar, product link, reviewer name, snippet, star rating)
4. **Network Orders** widget (only on WP Multisite main site – orders across all subsites)

Customizable via WordPress "Screen Options" panel.

**Settings hierarchy** is flat-tabbed (General / Products / Shipping / Payments / Accounts & Privacy / Emails / Advanced / Integration tabs added per plugin).

---

### 1.5 Alibaba.com "My Alibaba" (Seller-side)

B2B-specific patterns – useful for a multi-vendor admin because Alibaba treats suppliers as first-class entities:

**My Alibaba sidebar:**

| Group | Items |
|---|---|
| Home | Tasks, Tips, News |
| Products | Manage Products, Post New Products, Quotation Templates |
| RFQ | Manage RFQs, My Quotations, Won RFQs |
| Orders | Manage Orders, Logistics Orders, After-sales / Disputes |
| Trade Assurance | Orders under protection, Refunds |
| Customer | My Customers, Contacts, Mail Center, Customer Tags |
| Marketing | Promoted Listings, Top Search, SuperStar Supplier |
| Data & Insights | Product Performance, Store Performance, Buyer Behavior |
| Store Mgmt | Store Profile, Gold Supplier Status, Verification Docs |
| Settings | Member profile, Bank account, Sub-accounts, Permissions |

**Product moderation workflow** (Alibaba's key innovation relevant to Nouf-ex):

1. Supplier posts product → enters **Pending Review**
2. Platform moderator approves / rejects / requests changes
3. **Re-submission loop** with moderator notes
4. Approved → goes live; rejected → archived with reason
5. After live → monitorable via "Violation Records"

**Order dispute resolution:**

- **Public Dispute Resolution Center** – a unique Alibaba mechanism where peers (qualified buyers/sellers) vote on the outcome of disputed orders. Each side submits evidence, then a panel votes. Outcome is binding.
- Standard dispute states: Open → Under mediation → Resolved (refund / replacement / partial refund) → Closed
- Escalation to customer service agent if peer vote is contested

**RFQ (Request for Quotation) management:**

- Buyers post RFQ (item, qty, specs)
- Suppliers receive, send quotations
- Admin sees: open RFQs, quote rate (quotes sent / RFQs received), won RFQs, conversion to orders

**Store verification:** Gold Supplier tier requires document submission + annual fee; admin sees verification queue, document expiries, KYC status.

---

### 1.6 Shopify Flow / Analytics (custom dashboards)

**Shopify Flow** is the automation builder inside admin – lets admins compose triggers + conditions + actions to act on orders/customers/products/inventory.

**Custom dashboard patterns:**

- Compose widgets from any data field exposed via API
- Save & share dashboards across staff roles
- Cohort analysis builder (acquire date + behavior → retention curves)
- Customer lifetime value by acquisition source
- Sales by traffic referrer, by UTM, by landing page

---

## 2. Cross-platform pattern synthesis

### 2.1 Sidebar patterns observed

| Pattern | Adopted by |
|---|---|
| "Home / Dashboard" at top | Shopify, Magento, Woo, Amazon |
| Grouped by domain (Sales / Catalog / Customers / etc.) | Magento, Woo |
| Flat top-level menu (all items shown, no grouping) | Shopify (modern) |
| Settings as the last item | Universal |
| Verification queue / KYC as a prominent item | Alibaba (Gold Supplier) |
| Audit logs under System | Magento (`Action Log`) |
| Roles & permissions under Settings or System | Universal |

### 2.2 Dashboard widget patterns observed (consolidated)

The most common 12 KPIs across all five platforms:

1. **Sales today / this week / this month** (with delta %)
2. **Net revenue** (gross minus refunds)
3. **Orders count** (and status breakdown grid)
4. **Average order value (AOV)**
5. **Conversion rate** (sessions → orders)
6. **Sessions / traffic**
7. **New customers** (and active customers)
8. **Top-selling products** (table or bar chart)
9. **Low-stock / out-of-stock alerts**
10. **Recent orders** (compact list with quick actions)
11. **Pending moderation / pending KYC** (queue counters)
12. **Refund / dispute / defect rate** (health metric)

### 2.3 List-page patterns

Every platform uses the same six primitives:

- **Search bar** (top, full-width or left)
- **Filter chips / facets** (left rail or above table)
- **Saved filters / Saved searches** (reusable across sessions)
- **Bulk action toolbar** (slides in below header when rows selected)
- **Column chooser** (toggle visibility, save layout)
- **Export CSV** (and sometimes scheduled email exports)

### 2.4 Detail-page patterns

- **Header band**: title, status badge, action buttons (Save, Cancel, Delete), breadcrumbs
- **Tabbed sections** (Overview / Activity / Transactions / Notes)
- **Activity timeline / audit log** at bottom
- **Sidebar** with metadata (created by, last updated, tags, custom fields)
- **"Related records"** section (orders for a customer, products for a store)

### 2.5 Empty states & onboarding

- Shopify: **Setup checklist** with completion bar; each step has Learn more link
- WooCommerce: **WooCommerce Setup widget** replaces Status widget until done
- Magento: built-in sample data flag + first-time onboarding tour
- Amazon: **"What's new" panel** + **New Seller Guide** on first login
- Alibaba: **Tasks dashboard** prioritized by impact on sales

**Universal pattern:** an empty state always shows: (1) an illustration, (2) a one-line explanation of what will appear here, (3) a primary CTA button.

---

## 3. Recommendation for Nouf-ex

Nouf-ex is a multi-vendor marketplace. The platform admin needs capabilities beyond a single-store admin (Shopify/Woo) – including merchant onboarding, marketplace-wide moderation, payouts, and dispute resolution (Alibaba + Amazon pattern).

### 3.1 Sidebar groups (recommended, in priority order)

| # | Group | Purpose |
|---|---|---|
| 1 | **Overview** | Dashboard, alerts inbox, tasks |
| 2 | **Users** | All platform users (customers, merchants, admins) |
| 3 | **Stores** | All vendor stores + onboarding/verification queue |
| 4 | **Catalog** | All products, categories, reviews, moderation queue |
| 5 | **Orders** | All orders, refunds, disputes, RMA |
| 6 | **Payments** | Transactions, payouts, fees, subscriptions |
| 7 | **Marketing** | Coupons, promotions, broadcasts, ad campaigns |
| 8 | **Analytics** | Sales, traffic, geo, funnels, cohorts |
| 9 | **Support** | Tickets, reports, messages, returns |
| 10 | **Content** | Homepage, banners, CMS pages, FAQ, blog |
| 11 | **Localization** | Currencies, languages, countries, tax regions |
| 12 | **System** | Audit logs, health, settings, roles, API keys |

Below is the **concrete sub-item breakdown** for each group.

---

#### 3.1.1 Overview

| Item | Notes |
|---|---|
| Dashboard | 12 KPI widgets (see §3.2) |
| Inbox / Tasks | Admin tasks surfaced by the system (e.g. "3 stores need verification") |
| What's New | Platform changelog & feature release notes |
| Activity Feed | Recent admin actions across all entities |

#### 3.1.2 Users

| Item | Notes |
|---|---|
| All Customers | Search, filter, segment, ban, impersonate |
| Customer Segments | Saved segments (LTV, location, behavior) |
| All Merchants | Vendor accounts – separate from customers |
| Merchant Roles | Admin / staff / finance roles inside each merchant |
| All Admins | Internal platform staff |
| Impersonation Logs | Who logged in as whom, when |
| Banned / Suspended | Soft-deleted or blocked accounts |

#### 3.1.3 Stores

| Item | Notes |
|---|---|
| All Stores | List view with filter by status, country, plan |
| Verification Queue | Pending KYC, doc review |
| Store Profile Review | Banner, logo, description moderation |
| Featured Stores | Curate homepage featured slot |
| Store Subscriptions | Active plans, renewal dates |
| Store Performance | Per-store KPIs (revenue, AOV, defect rate) |
| Suspended Stores | Holds, suspensions, deactivations |

#### 3.1.4 Catalog

| Item | Notes |
|---|---|
| All Products | Cross-store product list with moderation status |
| Pending Moderation | Items awaiting platform review |
| Categories | Global taxonomy tree |
| Attributes | Shared product attributes (color, size, brand) |
| Brands | Master brand list (for verification) |
| Reviews | All reviews – reported + queue |
| Reported Content | User-reported items |
| Trending Products | Algorithm-curated list |
| Bulk Import/Export | CSV / Excel ingest |

#### 3.1.5 Orders

| Item | Notes |
|---|---|
| All Orders | Cross-store, cross-vendor master view |
| Order Detail | Line items per merchant, split shipping |
| Returns / RMA | Return merchandise authorization |
| Refunds | Issued + pending |
| Disputes | Open mediations (Alibaba pattern) |
| Cancelled Orders | Audit trail |
| Shipments | Tracking, carrier integration |
| Invoices | Generated per-merchant |

#### 3.1.6 Payments

| Item | Notes |
|---|---|
| Transactions | All platform payment events |
| Payouts | Vendor payout queue + history |
| Payment Methods | Configured gateways (Stripe, PayPal, local) |
| Currencies | Supported + active rates |
| Fees & Commissions | Platform fee rules |
| Subscriptions | SaaS billing if Nouf-ex charges a monthly fee |
| Tax Settings | VAT / sales tax per region |
| Refunds Ledger | Refund events across the platform |

#### 3.1.7 Marketing

| Item | Notes |
|---|---|
| Coupons | Platform-issued discount codes |
| Promotions | Campaigns (e.g. "Ramadan Sale") |
| Flash Sales | Time-bound marketplace-wide sales |
| Push Notifications | Broadcast to mobile apps |
| Email Broadcasts | Newsletter & segment emails |
| Banners | Homepage / category page creatives |
| Featured Slots | Paid placement for stores/products |

#### 3.1.8 Analytics

| Item | Notes |
|---|---|
| Overview Dashboard | KPI summary |
| Sales Reports | GMV, revenue, AOV, by period / store / country |
| Traffic Reports | Sessions, sources, device |
| Geo Reports | Sales by country / city |
| Funnels | Browse → cart → checkout → purchase |
| Cohort Retention | Repeat purchase by acquisition month |
| Store Rankings | Leaderboard by GMV |
| Product Rankings | Top sellers, trending |
| Custom Reports | Saved queries / scheduled exports |

#### 3.1.9 Support

| Item | Notes |
|---|---|
| Tickets | Customer/merchant support tickets |
| Reported Users | Abuse reports |
| Disputes Queue | Active marketplace disputes |
| Internal Notes | Admin-to-admin messages on entities |
| Returns Center | RMA workflow |
| Help Center | Knowledge base articles |

#### 3.1.10 Content

| Item | Notes |
|---|---|
| Homepage Builder | Drag-and-drop homepage slots |
| Banners | Top hero, category banners |
| Pages | Static pages (About, Terms, Privacy) |
| Blog / News | Editorial content |
| FAQ | Categorized FAQ items |
| Media Library | Image / video assets |
| Translations | Per-locale content overrides |

#### 3.1.11 Localization

| Item | Notes |
|---|---|
| Languages | Active locales + fallback |
| Currencies | FX rates |
| Countries | Allowed shipping origins/destinations |
| Tax Regions | VAT / GST / sales tax per region |
| Time Zones | Per-store override |
| Date Formats | Locale-specific |

#### 3.1.12 System

| Item | Notes |
|---|---|
| Audit Logs | Every admin action, immutable |
| System Health | API status, queue depths, job health |
| Scheduled Jobs | Cron status, manual trigger |
| Roles & Permissions | Granular RBAC, role templates |
| API Keys | Public + secret keys, webhooks |
| Feature Flags | Toggle features per region/store |
| Email Templates | Transactional email designs |
| Notification Templates | SMS / push templates |
| Integrations | Connected services (logistics, payments, analytics) |
| Settings → General | Platform name, logo, contact |
| Settings → Security | 2FA enforcement, session policy |
| Settings → Backup | Manual backup & restore |

---

### 3.2 Dashboard widgets (recommended set of 12)

Arrange in a 4×3 grid on wide screens, 2-column stack on narrow.

| # | Widget | Source pattern |
|---|---|---|
| 1 | **GMV today** (with delta vs yesterday) | Amazon + Shopify |
| 2 | **Orders today** (with status breakdown grid) | Woo "Status widget" |
| 3 | **Active customers** (logged in last 30d) | Alibaba "My Customers" |
| 4 | **New merchants this week** | Alibaba verification queue |
| 5 | **Average order value** (with sparkline) | Magento dashboard |
| 6 | **Conversion rate** (sessions → orders) | Shopify Analytics |
| 7 | **Pending verification** (stores + products) | Alibaba Gold Supplier queue |
| 8 | **Open disputes** (with severity tags) | Alibaba + Amazon |
| 9 | **Top 10 stores by GMV** (leaderboard) | Custom |
| 10 | **Top 10 products** (bestsellers) | Magento "Bestsellers" report |
| 11 | **Refund rate / defect rate** | Amazon Account Health |
| 12 | **Platform revenue (after fees)** | Custom – the platform's take rate |

**Below the grid:** a single Activity Feed showing the last 20 admin-relevant events (new merchant signed up, dispute opened, store suspended, large order placed, etc.).

---

### 3.3 List-page template (recommended)

Every entity list should expose:

1. **Search bar** with token support (`status:pending created:>7d`)
2. **Filter rail** (collapsible, with chips for active filters)
3. **Saved views** dropdown (Personal + Shared)
4. **Bulk action toolbar** (slides in on row selection)
5. **Table** with sortable columns and a column chooser
6. **Row actions menu** (View / Edit / Suspend / Delete)
7. **Pagination footer** with row count + "Export selected" button
8. **Empty state** with illustration + primary CTA
9. **First-time onboarding tooltip** on first visit

Default filters per list:

- Date range (today / 7d / 30d / quarter / custom)
- Status
- Country / region
- Owner (assigned admin)
- Tags
- Source channel (web / mobile / app)

---

### 3.4 Detail-page template (recommended)

For every entity (store / product / order / customer / dispute):

- **Header band**
  - Title (large)
  - Status pill (color-coded)
  - Action buttons (primary action = green, destructive = red, neutral = outline)
  - Breadcrumbs (e.g. `Catalog › Products › #12345`)
- **Tabbed body**
  - `Overview` – primary attributes
  - `Activity` – full audit log
  - `Transactions` – related financial events
  - `Notes` – internal admin notes (rich text)
- **Right sidebar**
  - Metadata (created by / on, last updated, owner)
  - Tags + quick tag add
  - Custom fields
- **Footer band**
  - Related records (e.g. orders for a customer)

---

### 3.5 Empty states & onboarding

For each main section, ship:

1. **First-run checklist** (only on Overview → Dashboard for 7 days after admin signup)
2. **Per-section empty state** with primary CTA (e.g. `Stores → All Stores` empty → "Invite your first merchant")
3. **Help icon** in every page header → links to docs specific to that page
4. **Sample data flag** (internal/test) – for previews and QA

---

### 3.6 Permission model

Recommend **RBAC + ABAC** hybrid:

| Built-in roles | Capability |
|---|---|
| **Super Admin** | Everything, including billing & roles |
| **Operations Manager** | Users, stores, catalog, orders, payments – full read/write |
| **Catalog Moderator** | Catalog + reports only |
| **Support Agent** | Read all, write only on tickets & disputes |
| **Finance** | Payments + payouts + refunds |
| **Marketing** | Marketing + content only |
| **Analyst** | Read all, no write |

Permission matrix is editable under `System → Roles & Permissions`. Every action is logged under `System → Audit Logs` with before/after snapshots.

---

### 3.7 Adoption matrix – what to take from each platform

| Capability | Source | Nouf-ex location |
|---|---|---|
| Sidebar grouping pattern | Magento | All 12 groups |
| Setup checklist on Home | Shopify | Overview → Inbox |
| KPI widgets + sparklines | Amazon | Overview → Dashboard |
| Verification queue | Alibaba | Stores → Verification Queue |
| Dispute resolution flow | Alibaba | Orders → Disputes |
| Audit logs | Magento | System → Audit Logs |
| Granular configuration | Magento | System → Settings (deep tree) |
| Custom dashboards | Shopify Flow | Analytics → Custom Reports |
| Status widget grid | WooCommerce | Overview widget #2 |
| Real-time activity feed | Amazon | Overview → Activity Feed |
| Saved filters | Universal | All lists |
| Bulk actions | Universal | All lists |
| Impersonation | Magento "Login as Customer" | Users → Impersonation Logs |
| Public dispute voting | Alibaba (unique) | Optional v2 feature |

---

## 4. Open questions for the Nouf-ex team

1. **Tenancy** – is each merchant a separate logical store with isolated data, or shared catalog? (Affects Catalog menu.)
2. **Payouts** – manual review queue vs. automated? (Affects Payments menu depth.)
3. **Disputes** – peer-vote model (Alibaba) vs. internal agent-only? (Affects Support menu.)
4. **Subscriptions** – does Nouf-ex charge merchants a SaaS fee? (Adds Subscriptions sub-menu.)
5. **Multi-country** – single currency per country or FX? (Affects Localization menu.)
6. **Mobile admin** – web-only or also a native app? (Affects widget density.)

---

## 5. Implementation milestones (suggested)

| Milestone | Scope | Effort (rough) |
|---|---|---|
| M1 | Sidebar IA, Overview dashboard with 12 widgets, empty states | 3 weeks |
| M2 | Users + Stores + Catalog (list + detail + bulk actions) | 4 weeks |
| M3 | Orders + Payments + Refunds | 4 weeks |
| M4 | Marketing + Analytics | 3 weeks |
| M5 | Support + Disputes | 3 weeks |
| M6 | Content + Localization + System (incl. RBAC & audit log) | 4 weeks |

---

**End of report.** All patterns above are grounded in the documented structure of
Shopify Admin, Adobe Commerce Admin, WooCommerce, Amazon Seller Central, and
Alibaba "My Alibaba" as of 2026.