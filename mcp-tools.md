# SouqMetrics MCP Tools

Authentication is via OAuth 2.0 Bearer token (see SETUP.md). All requests must include `Authorization: Bearer <token>`.

All tools that accept `timeframe` support: `today`, `last_7_days`, `last_30_days`, `last_90_days` (default: `last_30_days`).

---

## OAuth Endpoints

### GET /oauth/authorize
Returns the URL the user should visit to grant access.

**Query params:** `client_id?`, `redirect_uri` (must start with `https://`), `state?`
**Response:** `{ ok: true, authorize_url: "https://app.souqmetrics.co/oauth/authorize?..." }`

### POST /oauth/token
Exchanges an authorization code for a Bearer token.

**Body:** `{ grant_type: "authorization_code", code: "<code>" }`
**Response:** `{ access_token, token_type: "Bearer", expires_in: 7776000 }`

---

## 1. list_workspaces
Return all workspaces the authenticated user has access to. Call this first to get valid `business_id` values.

**Inputs:** _(none — identity comes from the Bearer token)_
**Output:** `workspaces[]` — id, name, currency

---

## 2. get_business_summary
Total revenue, order count, and average order value for a workspace.

**Inputs:** `business_id`, `timeframe?`
**Output:** `total_revenue`, `total_orders`, `average_order_value`, `timeframe`

---

## 3. get_kpi_metrics
Full KPI snapshot: revenue, orders, AOV, ad spend, ROAS, CPA, paid revenue — plus % changes vs the prior equivalent period.

**Inputs:** `business_id`, `timeframe?`
**Output:** `current` (revenue, orders, aov, ad_spend, paid_revenue, roas, cpa), `changes` (revenue_pct, orders_pct, aov_pct, ad_spend_pct, roas_pct, cpa_pct)

---

## 4. get_profit_summary
Estimated profit and margin based on the user's cost settings (COGS %, delivery %, fixed fees).

**Inputs:** `business_id`, `timeframe?`
**Output:** `revenue`, `orders`, `estimated_profit`, `margin_pct`, `cost_breakdown` (cogs, delivery, fixed)

---

## 5. get_channel_breakdown
Revenue and orders grouped into three buckets: Paid Social, Organic Social, Direct/Search.

**Inputs:** `business_id`, `timeframe?`
**Output:** `channels` — paid_social, organic_social, direct_search (each: revenue, orders)

---

## 6. get_top_products
Top-performing products by revenue.

**Inputs:** `business_id`, `timeframe?`, `limit?` (default 10, max 50)
**Output:** `products[]` — product_name, revenue, orders

---

## 7. get_payment_breakdown
Revenue and orders split by payment method: Card, COD, Whish, BNPL, Other.

**Inputs:** `business_id`, `timeframe?`
**Output:** `payment_methods` — card, cod, whish, bnpl, other (each: orders, revenue)

---

## 8. get_geographic_breakdown
Top locations (country + city) by revenue with revenue share %.

**Inputs:** `business_id`, `timeframe?`, `limit?` (default 10, max 50)
**Output:** `locations[]` — country, city, orders, revenue, revenue_pct

---

## 9. get_daily_trends
Day-by-day revenue, order count, paid revenue, and ad spend.

**Inputs:** `business_id`, `timeframe?`
**Output:** `days[]` — date, revenue, orders, paid_revenue, ad_spend
