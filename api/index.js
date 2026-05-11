import { config } from "dotenv";
config();

import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  getStartDateFromTimeframe,
  getPreviousStartDate,
  verifyEmailAccess,
} from "../lib/helpers.js";

const app = express();
app.use(express.json());

// ── API key guard ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/health") return next();

  const qs = new URL(req.url, `http://localhost`).searchParams;
  const apiKey = req.headers["x-api-key"] || qs.get("api_key");
  if (!apiKey) return res.status(401).json({ ok: false, error: "Missing API key" });
  if (apiKey !== process.env.MCP_API_KEY)
    return res.status(403).json({ ok: false, error: "Invalid API key" });

  next();
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("SouqMetrics MCP API is running."));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Workspaces ─────────────────────────────────────────────────────────────────

app.get("/workspace-list-by-user", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ ok: false, error: "Missing email" });

    const { data: memberships, error: membershipsError } = await supabase
      .from("workspace_members")
      .select("business_id")
      .eq("email", email);

    if (membershipsError)
      return res.status(500).json({ ok: false, error: membershipsError.message });

    const businessIds = (memberships || []).map((m) => m.business_id);
    if (businessIds.length === 0) return res.json({ ok: true, workspaces: [] });

    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, business_name, currency")
      .in("id", businessIds);

    if (businessesError)
      return res.status(500).json({ ok: false, error: businessesError.message });

    return res.json({
      ok: true,
      workspaces: (businesses || []).map((b) => ({
        id: b.id,
        name: b.business_name,
        currency: b.currency || "USD",
      })),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Business Summary ───────────────────────────────────────────────────────────

app.get("/business-summary-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("order_total")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const totalRevenue = (data || []).reduce((sum, o) => sum + Number(o.order_total || 0), 0);
    const totalOrders = (data || []).length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.json({
      ok: true,
      timeframe,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      average_order_value: averageOrderValue,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── KPI Metrics (with comparison period) ──────────────────────────────────────

app.get("/kpi-metrics-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);
    const { prevStart, prevEnd } = getPreviousStartDate(startDate);

    // Current period orders
    const { data: currentOrders, error: currErr } = await supabase
      .from("orders")
      .select("order_total, channel")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (currErr) return res.status(500).json({ ok: false, error: currErr.message });

    // Previous period orders
    const { data: prevOrders, error: prevErr } = await supabase
      .from("orders")
      .select("order_total")
      .eq("business_id", business_id)
      .gte("order_date", prevStart)
      .lte("order_date", prevEnd);

    if (prevErr) return res.status(500).json({ ok: false, error: prevErr.message });

    // Current period ad spend
    const spendStart = startDate.slice(0, 10);
    const { data: spendRows, error: spendErr } = await supabase
      .from("ad_spend_daily")
      .select("spend")
      .eq("business_id", business_id)
      .gte("spend_date", spendStart);

    if (spendErr) return res.status(500).json({ ok: false, error: spendErr.message });

    // Previous period ad spend
    const { data: prevSpendRows } = await supabase
      .from("ad_spend_daily")
      .select("spend")
      .eq("business_id", business_id)
      .gte("spend_date", prevStart.slice(0, 10))
      .lte("spend_date", prevEnd.slice(0, 10));

    const PAID_CHANNELS = ["meta", "google", "tiktok"];

    const revenue = (currentOrders || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
    const orders = (currentOrders || []).length;
    const paidRevenue = (currentOrders || [])
      .filter((o) => PAID_CHANNELS.includes((o.channel || "").toLowerCase()))
      .reduce((s, o) => s + Number(o.order_total || 0), 0);
    const adSpend = (spendRows || []).reduce((s, r) => s + Number(r.spend || 0), 0);

    const aov = orders > 0 ? revenue / orders : null;
    const roas = adSpend > 0 && revenue > 0 ? revenue / adSpend : null;
    const cpa = adSpend > 0 && orders > 0 ? adSpend / orders : null;

    const prevRevenue = (prevOrders || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
    const prevOrderCount = (prevOrders || []).length;
    const prevAdSpend = (prevSpendRows || []).reduce((s, r) => s + Number(r.spend || 0), 0);
    const prevAov = prevOrderCount > 0 ? prevRevenue / prevOrderCount : null;
    const prevRoas = prevAdSpend > 0 && prevRevenue > 0 ? prevRevenue / prevAdSpend : null;
    const prevCpa = prevAdSpend > 0 && prevOrderCount > 0 ? prevAdSpend / prevOrderCount : null;

    const pctChange = (curr, prev) =>
      prev && prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

    return res.json({
      ok: true,
      timeframe,
      current: {
        revenue,
        orders,
        aov,
        ad_spend: adSpend,
        paid_revenue: paidRevenue,
        roas,
        cpa,
      },
      changes: {
        revenue_pct: pctChange(revenue, prevRevenue),
        orders_pct: pctChange(orders, prevOrderCount),
        aov_pct: prevAov && aov ? pctChange(aov, prevAov) : null,
        ad_spend_pct: pctChange(adSpend, prevAdSpend),
        roas_pct: prevRoas && roas ? pctChange(roas, prevRoas) : null,
        cpa_pct: prevCpa && cpa ? pctChange(cpa, prevCpa) : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Channel Breakdown ──────────────────────────────────────────────────────────

app.get("/channel-breakdown-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("order_total, utm_source, utm_medium, channel, source_platform")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const channels = {
      paid_social: { revenue: 0, orders: 0 },
      organic_social: { revenue: 0, orders: 0 },
      direct_search: { revenue: 0, orders: 0 },
    };

    for (const order of data || []) {
      const revenue = Number(order.order_total || 0);
      const source = (order.utm_source || "").toLowerCase();
      const medium = (order.utm_medium || "").toLowerCase();
      const channel = (order.channel || "").toLowerCase();
      const sourcePlatform = (order.source_platform || "").toLowerCase();

      const isPaidSocial =
        medium.includes("paid") ||
        medium.includes("cpc") ||
        medium.includes("ppc") ||
        channel === "meta" ||
        channel === "google" ||
        channel === "tiktok" ||
        channel.includes("paid") ||
        sourcePlatform.includes("meta") ||
        sourcePlatform.includes("facebook ads") ||
        sourcePlatform.includes("instagram ads") ||
        sourcePlatform.includes("tiktok ads");

      const isOrganicSocial =
        !isPaidSocial &&
        (medium === "social" ||
          source === "instagram" ||
          source === "ig" ||
          source === "facebook" ||
          source === "tiktok" ||
          source.includes("social") ||
          channel.includes("organic social") ||
          sourcePlatform === "instagram" ||
          sourcePlatform === "facebook" ||
          sourcePlatform === "tiktok");

      const bucket = isPaidSocial
        ? "paid_social"
        : isOrganicSocial
        ? "organic_social"
        : "direct_search";

      channels[bucket].revenue += revenue;
      channels[bucket].orders += 1;
    }

    return res.json({ ok: true, timeframe, channels });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Top Products ───────────────────────────────────────────────────────────────

app.get("/top-products-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;
    const limit = Number(req.query.limit || 10);

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (ordersError) return res.status(500).json({ ok: false, error: ordersError.message });

    const orderIds = (orders || []).map((o) => o.id);
    if (orderIds.length === 0) return res.json({ ok: true, timeframe, products: [] });

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name, revenue")
      .in("order_id", orderIds);

    if (itemsError) return res.status(500).json({ ok: false, error: itemsError.message });

    const productTotals = {};
    for (const item of items || []) {
      const name = item.product_name || "Unnamed Product";
      const revenue = Number(item.revenue || 0);
      if (!productTotals[name]) productTotals[name] = { product_name: name, revenue: 0, orders: 0 };
      productTotals[name].revenue += revenue;
      productTotals[name].orders += 1;
    }

    const products = Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return res.json({ ok: true, timeframe, products });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Payment Breakdown ──────────────────────────────────────────────────────────

app.get("/payment-breakdown-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("payment_method, order_total")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const breakdown = {
      card: { orders: 0, revenue: 0 },
      cod: { orders: 0, revenue: 0 },
      whish: { orders: 0, revenue: 0 },
      bnpl: { orders: 0, revenue: 0 },
      other: { orders: 0, revenue: 0 },
    };

    for (const order of data || []) {
      const method = (order.payment_method || "").toLowerCase();
      const revenue = Number(order.order_total || 0);

      let bucket = "other";
      if (method === "card" || method.includes("card")) bucket = "card";
      else if (method === "cod") bucket = "cod";
      else if (method === "whish") bucket = "whish";
      else if (
        method === "bnpl" ||
        method.includes("tabby") ||
        method.includes("tamara")
      )
        bucket = "bnpl";

      breakdown[bucket].orders += 1;
      breakdown[bucket].revenue += revenue;
    }

    return res.json({ ok: true, timeframe, payment_methods: breakdown });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Profit Summary ─────────────────────────────────────────────────────────────

app.get("/profit-summary-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("order_total")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (ordersError) return res.status(500).json({ ok: false, error: ordersError.message });

    const { data: costs, error: costError } = await supabase
      .from("business_cost_settings")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (costError) return res.status(500).json({ ok: false, error: costError.message });

    const revenue = (orders || []).reduce((sum, o) => sum + Number(o.order_total || 0), 0);
    const ordersCount = (orders || []).length;

    const cogsCost = revenue * ((costs.cogs_pct || 0) / 100);
    const deliveryCost = revenue * ((costs.delivery_pct || 0) / 100);
    const fixedCosts =
      Number(costs.monthly_platform_fee || 0) + Number(costs.monthly_agency_fee || 0);

    const estimatedProfit = revenue - cogsCost - deliveryCost - fixedCosts;
    const marginPct = revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;

    return res.json({
      ok: true,
      timeframe,
      revenue,
      orders: ordersCount,
      estimated_profit: Number(estimatedProfit.toFixed(2)),
      margin_pct: Number(marginPct.toFixed(2)),
      cost_breakdown: {
        cogs: Number(cogsCost.toFixed(2)),
        delivery: Number(deliveryCost.toFixed(2)),
        fixed: Number(fixedCosts.toFixed(2)),
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Geographic Breakdown ───────────────────────────────────────────────────────

app.get("/geographic-breakdown-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;
    const limit = Number(req.query.limit || 10);

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("country_name, city, order_total")
      .eq("business_id", business_id)
      .gte("order_date", startDate);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const map = {};
    let totalRevenue = 0;

    for (const o of data || []) {
      const country = o.country_name || "Unknown";
      const city = normalizeCity(o.city);
      const revenue = Number(o.order_total || 0);
      totalRevenue += revenue;

      const key = `${country}__${city}`;
      if (!map[key]) map[key] = { country, city, orders: 0, revenue: 0 };
      map[key].orders += 1;
      map[key].revenue += revenue;
    }

    const locations = Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map((r) => ({
        ...r,
        revenue_pct: totalRevenue ? Number(((r.revenue / totalRevenue) * 100).toFixed(1)) : 0,
      }));

    return res.json({ ok: true, timeframe, locations });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

function normalizeCity(city) {
  if (!city) return "Unknown";
  const c = city.toLowerCase().trim();
  if (
    c.includes("beirut") ||
    c.includes("beyrouth") ||
    c.includes("bayrut") ||
    c.includes("beiru") ||
    c.includes("بيروت")
  )
    return "Beirut";
  return city.trim();
}

// ── Daily Trends ───────────────────────────────────────────────────────────────

app.get("/daily-trends-by-user", async (req, res) => {
  try {
    const { email, business_id, timeframe = "last_30_days" } = req.query;

    if (!email || !business_id)
      return res.status(400).json({ ok: false, error: "Missing email or business_id" });

    const access = await verifyEmailAccess(supabase, email, business_id);
    if (!access.ok) return res.status(403).json({ ok: false, error: access.error });

    const startDate = getStartDateFromTimeframe(timeframe);
    const startDateOnly = startDate.slice(0, 10);

    const [ordersResult, spendResult] = await Promise.all([
      supabase
        .from("orders")
        .select("order_date, order_total, channel")
        .eq("business_id", business_id)
        .gte("order_date", startDate),
      supabase
        .from("ad_spend_daily")
        .select("spend_date, spend")
        .eq("business_id", business_id)
        .gte("spend_date", startDateOnly),
    ]);

    if (ordersResult.error)
      return res.status(500).json({ ok: false, error: ordersResult.error.message });
    if (spendResult.error)
      return res.status(500).json({ ok: false, error: spendResult.error.message });

    const PAID_CHANNELS = ["meta", "google", "tiktok"];
    const byDay = {};

    for (const o of ordersResult.data || []) {
      const day = o.order_date.slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0, paid_revenue: 0, ad_spend: 0 };
      const amount = Number(o.order_total || 0);
      byDay[day].revenue += amount;
      byDay[day].orders += 1;
      if (PAID_CHANNELS.includes((o.channel || "").toLowerCase())) {
        byDay[day].paid_revenue += amount;
      }
    }

    for (const s of spendResult.data || []) {
      const day = s.spend_date;
      if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0, paid_revenue: 0, ad_spend: 0 };
      byDay[day].ad_spend += Number(s.spend || 0);
    }

    const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ ok: true, timeframe, days });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`SouqMetrics API running on port ${PORT}`);
  });
}
