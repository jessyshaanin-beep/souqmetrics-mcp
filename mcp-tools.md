# SouqMetrics MCP Tools

All tools require `user_id` (Supabase UID) and, except `list_workspaces`, a `business_id` from the user's workspaces.
All tools that accept `timeframe` support: `today`, `last_7_days`, `last_30_days`, `last_90_days` (default: `last_30_days`).

---

## 1. list_workspaces
Return all workspaces the authenticated user has access to. Call this first to get valid `business_id` values.

**Inputs:** `user_id`
**Output:** `workspaces[]` — id, name, currency

---

## 2. get_business_summary
Total revenue, order count, and average order value for a workspace.

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `total_revenue`, `total_orders`, `average_order_value`, `timeframe`

---

## 3. get_kpi_metrics
Full KPI snapshot: revenue, orders, AOV, ad spend, ROAS, CPA, paid revenue — plus % changes vs the prior equivalent period.

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `current` (revenue, orders, aov, ad_spend, paid_revenue, roas, cpa), `changes` (revenue_pct, orders_pct, aov_pct, ad_spend_pct, roas_pct, cpa_pct)

---

## 4. get_profit_summary
Estimated profit and margin based on the user's cost settings (COGS %, delivery %, fixed fees).

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `revenue`, `orders`, `estimated_profit`, `margin_pct`, `cost_breakdown` (cogs, delivery, fixed)

---

## 5. get_channel_breakdown
Revenue and orders grouped into three buckets: Paid Social, Organic Social, Direct/Search.

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `channels` — paid_social, organic_social, direct_search (each: revenue, orders)

---

## 6. get_top_products
Top-performing products by revenue.

**Inputs:** `user_id`, `business_id`, `timeframe?`, `limit?` (default 10, max 50)
**Output:** `products[]` — product_name, revenue, orders

---

## 7. get_payment_breakdown
Revenue and orders split by payment method: Card, COD, Whish, BNPL, Other.

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `payment_methods` — card, cod, whish, bnpl, other (each: orders, revenue)

---

## 8. get_geographic_breakdown
Top locations (country + city) by revenue with revenue share %.

**Inputs:** `user_id`, `business_id`, `timeframe?`, `limit?` (default 10, max 50)
**Output:** `locations[]` — country, city, orders, revenue, revenue_pct

---

## 9. get_daily_trends
Day-by-day revenue, order count, paid revenue, and ad spend.

**Inputs:** `user_id`, `business_id`, `timeframe?`
**Output:** `days[]` — date, revenue, orders, paid_revenue, ad_spend
