import { config } from "dotenv";
config();

import { randomUUID, createHash } from "crypto";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v3";
import {
  getStartDateFromTimeframe,
  getPreviousStartDate,
  verifyUserAccess,
} from "../lib/helpers.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow MCP Inspector and browser-based clients to connect
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAID_CHANNELS = ["meta", "google", "tiktok"];

// ── Auth helpers ───────────────────────────────────────────────────────────────

// Resolve a raw Bearer token string → user_id or null
async function resolveToken(token) {
  if (!token) return null;
  const { data: row } = await supabase
    .from("oauth_access_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row.user_id;
}

// Express middleware convenience: reads Authorization header, sends 401 on failure
async function verifyToken(req, res) {
  const token = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const userId = await resolveToken(token);
  if (!userId) {
    res.status(token ? 401 : 401).json({
      ok: false,
      error: token ? "Invalid or expired token" : "Missing token",
    });
    return null;
  }
  return userId;
}

// ── Shared utilities ───────────────────────────────────────────────────────────

function normalizeCity(city) {
  if (!city) return "Unknown";
  const c = city.toLowerCase().trim();
  if (
    c.includes("beirut") || c.includes("beyrouth") ||
    c.includes("bayrut") || c.includes("beiru") || c.includes("بيروت")
  ) return "Beirut";
  return city.trim();
}

// ── Query helpers (shared by REST routes and MCP SSE tools) ───────────────────
// All helpers throw on error (callers wrap in try/catch).
// Access-denied errors attach err.status = 403.

async function queryWorkspaces(userId) {
  const { data: memberships, error: me } = await supabase
    .from("workspace_members")
    .select("business_id")
    .eq("user_id", userId);
  if (me) throw new Error(me.message);

  const businessIds = (memberships || []).map((m) => m.business_id);
  if (businessIds.length === 0) return { ok: true, workspaces: [] };

  const { data: businesses, error: be } = await supabase
    .from("businesses")
    .select("id, business_name, currency")
    .in("id", businessIds);
  if (be) throw new Error(be.message);

  return {
    ok: true,
    workspaces: (businesses || []).map((b) => ({
      id: b.id,
      name: b.business_name,
      currency: b.currency || "USD",
    })),
  };
}

async function queryBusinessSummary(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { data, error } = await supabase
    .from("orders")
    .select("order_total")
    .eq("business_id", businessId)
    .gte("order_date", startDate);
  if (error) throw new Error(error.message);

  const totalRevenue = (data || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
  const totalOrders = (data || []).length;
  return {
    ok: true,
    timeframe,
    total_revenue: totalRevenue,
    total_orders: totalOrders,
    average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
}

async function queryKpiMetrics(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { prevStart, prevEnd } = getPreviousStartDate(startDate);

  const [{ data: curr, error: cErr }, { data: prev, error: pErr }, { data: spend, error: sErr }] =
    await Promise.all([
      supabase.from("orders").select("order_total, channel").eq("business_id", businessId).gte("order_date", startDate),
      supabase.from("orders").select("order_total").eq("business_id", businessId).gte("order_date", prevStart).lte("order_date", prevEnd),
      supabase.from("ad_spend_daily").select("spend").eq("business_id", businessId).gte("spend_date", startDate.slice(0, 10)),
    ]);
  if (cErr) throw new Error(cErr.message);
  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);

  const { data: prevSpend } = await supabase
    .from("ad_spend_daily").select("spend").eq("business_id", businessId)
    .gte("spend_date", prevStart.slice(0, 10)).lte("spend_date", prevEnd.slice(0, 10));

  const revenue = (curr || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
  const orders = (curr || []).length;
  const paidRevenue = (curr || []).filter((o) => PAID_CHANNELS.includes((o.channel || "").toLowerCase())).reduce((s, o) => s + Number(o.order_total || 0), 0);
  const adSpend = (spend || []).reduce((s, r) => s + Number(r.spend || 0), 0);
  const aov = orders > 0 ? revenue / orders : null;
  const roas = adSpend > 0 ? revenue / adSpend : null;
  const cpa = adSpend > 0 && orders > 0 ? adSpend / orders : null;

  const prevRevenue = (prev || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
  const prevOrders = (prev || []).length;
  const prevAdSpend = (prevSpend || []).reduce((s, r) => s + Number(r.spend || 0), 0);
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : null;
  const prevRoas = prevAdSpend > 0 ? prevRevenue / prevAdSpend : null;
  const prevCpa = prevAdSpend > 0 && prevOrders > 0 ? prevAdSpend / prevOrders : null;

  const pct = (a, b) => b && b > 0 ? Math.round(((a - b) / b) * 100) : null;

  return {
    ok: true, timeframe,
    current: { revenue, orders, aov, ad_spend: adSpend, paid_revenue: paidRevenue, roas, cpa },
    changes: {
      revenue_pct: pct(revenue, prevRevenue),
      orders_pct: pct(orders, prevOrders),
      aov_pct: aov && prevAov ? pct(aov, prevAov) : null,
      ad_spend_pct: pct(adSpend, prevAdSpend),
      roas_pct: roas && prevRoas ? pct(roas, prevRoas) : null,
      cpa_pct: cpa && prevCpa ? pct(cpa, prevCpa) : null,
    },
  };
}

async function queryChannelBreakdown(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { data, error } = await supabase
    .from("orders")
    .select("order_total, utm_source, utm_medium, channel, source_platform")
    .eq("business_id", businessId)
    .gte("order_date", startDate);
  if (error) throw new Error(error.message);

  const channels = {
    paid_social: { revenue: 0, orders: 0 },
    organic_social: { revenue: 0, orders: 0 },
    direct_search: { revenue: 0, orders: 0 },
  };

  for (const order of data || []) {
    const rev = Number(order.order_total || 0);
    const source = (order.utm_source || "").toLowerCase();
    const medium = (order.utm_medium || "").toLowerCase();
    const ch = (order.channel || "").toLowerCase();
    const sp = (order.source_platform || "").toLowerCase();

    const isPaid = medium.includes("paid") || medium.includes("cpc") || medium.includes("ppc") ||
      ch === "meta" || ch === "google" || ch === "tiktok" || ch.includes("paid") ||
      sp.includes("meta") || sp.includes("facebook ads") || sp.includes("instagram ads") || sp.includes("tiktok ads");

    const isOrganic = !isPaid && (medium === "social" || source === "instagram" || source === "ig" ||
      source === "facebook" || source === "tiktok" || source.includes("social") ||
      ch.includes("organic social") || sp === "instagram" || sp === "facebook" || sp === "tiktok");

    const bucket = isPaid ? "paid_social" : isOrganic ? "organic_social" : "direct_search";
    channels[bucket].revenue += rev;
    channels[bucket].orders += 1;
  }

  return { ok: true, timeframe, channels };
}

async function queryTopProducts(userId, businessId, timeframe, limit) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { data: orders, error: oErr } = await supabase
    .from("orders").select("id").eq("business_id", businessId).gte("order_date", startDate);
  if (oErr) throw new Error(oErr.message);

  const orderIds = (orders || []).map((o) => o.id);
  if (orderIds.length === 0) return { ok: true, timeframe, products: [] };

  const { data: items, error: iErr } = await supabase
    .from("order_items").select("product_name, revenue").in("order_id", orderIds);
  if (iErr) throw new Error(iErr.message);

  const totals = {};
  for (const item of items || []) {
    const name = item.product_name || "Unnamed Product";
    const rev = Number(item.revenue || 0);
    if (!totals[name]) totals[name] = { product_name: name, revenue: 0, orders: 0 };
    totals[name].revenue += rev;
    totals[name].orders += 1;
  }

  return {
    ok: true, timeframe,
    products: Object.values(totals).sort((a, b) => b.revenue - a.revenue).slice(0, limit),
  };
}

async function queryPaymentBreakdown(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { data, error } = await supabase
    .from("orders").select("payment_method, order_total").eq("business_id", businessId).gte("order_date", startDate);
  if (error) throw new Error(error.message);

  const breakdown = {
    card: { orders: 0, revenue: 0 }, cod: { orders: 0, revenue: 0 },
    whish: { orders: 0, revenue: 0 }, bnpl: { orders: 0, revenue: 0 }, other: { orders: 0, revenue: 0 },
  };

  for (const order of data || []) {
    const method = (order.payment_method || "").toLowerCase();
    const rev = Number(order.order_total || 0);
    let bucket = "other";
    if (method === "card" || method.includes("card")) bucket = "card";
    else if (method === "cod") bucket = "cod";
    else if (method === "whish") bucket = "whish";
    else if (method === "bnpl" || method.includes("tabby") || method.includes("tamara")) bucket = "bnpl";
    breakdown[bucket].orders += 1;
    breakdown[bucket].revenue += rev;
  }

  return { ok: true, timeframe, payment_methods: breakdown };
}

async function queryProfitSummary(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const [{ data: orders, error: oErr }, { data: costs, error: cErr }] = await Promise.all([
    supabase.from("orders").select("order_total").eq("business_id", businessId).gte("order_date", startDate),
    supabase.from("business_cost_settings").select("*").eq("business_id", businessId).single(),
  ]);
  if (oErr) throw new Error(oErr.message);
  if (cErr) throw new Error(cErr.message);

  const revenue = (orders || []).reduce((s, o) => s + Number(o.order_total || 0), 0);
  const ordersCount = (orders || []).length;
  const cogsCost = revenue * ((costs.cogs_pct || 0) / 100);
  const deliveryCost = revenue * ((costs.delivery_pct || 0) / 100);
  const fixedCosts = Number(costs.monthly_platform_fee || 0) + Number(costs.monthly_agency_fee || 0);
  const estimatedProfit = revenue - cogsCost - deliveryCost - fixedCosts;

  return {
    ok: true, timeframe, revenue, orders: ordersCount,
    estimated_profit: Number(estimatedProfit.toFixed(2)),
    margin_pct: Number((revenue > 0 ? (estimatedProfit / revenue) * 100 : 0).toFixed(2)),
    cost_breakdown: {
      cogs: Number(cogsCost.toFixed(2)),
      delivery: Number(deliveryCost.toFixed(2)),
      fixed: Number(fixedCosts.toFixed(2)),
    },
  };
}

async function queryGeographicBreakdown(userId, businessId, timeframe, limit) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const { data, error } = await supabase
    .from("orders").select("country_name, city, order_total").eq("business_id", businessId).gte("order_date", startDate);
  if (error) throw new Error(error.message);

  const map = {};
  let totalRevenue = 0;
  for (const o of data || []) {
    const country = o.country_name || "Unknown";
    const city = normalizeCity(o.city);
    const rev = Number(o.order_total || 0);
    totalRevenue += rev;
    const key = `${country}__${city}`;
    if (!map[key]) map[key] = { country, city, orders: 0, revenue: 0 };
    map[key].orders += 1;
    map[key].revenue += rev;
  }

  return {
    ok: true, timeframe,
    locations: Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map((r) => ({ ...r, revenue_pct: totalRevenue ? Number(((r.revenue / totalRevenue) * 100).toFixed(1)) : 0 })),
  };
}

async function queryDailyTrends(userId, businessId, timeframe) {
  const access = await verifyUserAccess(supabase, userId, businessId);
  if (!access.ok) { const e = new Error(access.error); e.status = 403; throw e; }

  const startDate = getStartDateFromTimeframe(timeframe);
  const [ordersResult, spendResult] = await Promise.all([
    supabase.from("orders").select("order_date, order_total, channel").eq("business_id", businessId).gte("order_date", startDate),
    supabase.from("ad_spend_daily").select("spend_date, spend").eq("business_id", businessId).gte("spend_date", startDate.slice(0, 10)),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (spendResult.error) throw new Error(spendResult.error.message);

  const byDay = {};
  for (const o of ordersResult.data || []) {
    const day = o.order_date.slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0, paid_revenue: 0, ad_spend: 0 };
    const amount = Number(o.order_total || 0);
    byDay[day].revenue += amount;
    byDay[day].orders += 1;
    if (PAID_CHANNELS.includes((o.channel || "").toLowerCase())) byDay[day].paid_revenue += amount;
  }
  for (const s of spendResult.data || []) {
    const day = s.spend_date;
    if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0, paid_revenue: 0, ad_spend: 0 };
    byDay[day].ad_spend += Number(s.spend || 0);
  }

  return {
    ok: true, timeframe,
    days: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// ── MCP over Streamable HTTP ───────────────────────────────────────────────────
// Builds a fresh McpServer bound to a validated userId.
// Used for Streamable HTTP connections (stateless — one transport per request).

const businessOnly = {
  business_id: z.string().describe("Workspace / business ID (from list_workspaces)"),
};
const timeframeField = {
  timeframe: z
    .enum(["today", "last_7_days", "last_30_days", "last_90_days"])
    .optional()
    .describe("Time window. Defaults to last_30_days."),
};

function mcpResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: !data.ok };
}
function mcpError(err) {
  const data = { ok: false, error: err.message };
  return { content: [{ type: "text", text: JSON.stringify(data) }], isError: true };
}

function buildMcpServer(userId) {
  const mcpServer = new McpServer({
    name: "SouqMetrics",
    version: "1.0.0",
    description: "Analytics tools for SouqMetrics — query revenue, orders, channels, products, geography, and ad performance for your ecommerce workspace.",
  });

  mcpServer.registerTool("list_workspaces", {
    title: "List Workspaces",
    description: "Return all workspaces the authenticated SouqMetrics user has access to. Always call this first to get valid business_id values before calling any other tool.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({}),
  }, async () => {
    try { return mcpResult(await queryWorkspaces(userId)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_business_summary", {
    title: "Get Business Summary",
    description: "Return total revenue, total orders, and average order value for a workspace over a given timeframe.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryBusinessSummary(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_kpi_metrics", {
    title: "Get KPI Metrics",
    description: "Return full KPI report: revenue, orders, AOV, ad spend, ROAS, CPA, paid revenue — plus percentage changes vs the prior equivalent period. Use this for performance snapshots and trend analysis.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryKpiMetrics(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_profit_summary", {
    title: "Get Profit Summary",
    description: "Return estimated profit, margin %, and cost breakdown (COGS, delivery, fixed costs) for a workspace. Requires the user to have configured cost settings in SouqMetrics.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryProfitSummary(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_channel_breakdown", {
    title: "Get Channel Breakdown",
    description: "Return revenue and order counts grouped into three buckets: Paid Social (Meta, TikTok, Google), Organic Social (Instagram, Facebook, TikTok organic), and Direct / Search. Use this to understand channel mix.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryChannelBreakdown(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_top_products", {
    title: "Get Top Products",
    description: "Return the top-performing products ranked by revenue for a given timeframe. Each product includes total revenue and order count.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      ...businessOnly, ...timeframeField,
      limit: z.number().int().min(1).max(50).optional().describe("Number of products to return. Defaults to 10."),
    }),
  }, async ({ business_id, timeframe = "last_30_days", limit = 10 }) => {
    try { return mcpResult(await queryTopProducts(userId, business_id, timeframe, limit)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_payment_breakdown", {
    title: "Get Payment Breakdown",
    description: "Return revenue and order counts grouped by payment method: Card, COD (cash on delivery), Whish, BNPL (Tabby / Tamara), and Other.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryPaymentBreakdown(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_geographic_breakdown", {
    title: "Get Geographic Breakdown",
    description: "Return top locations (country + city) ranked by revenue. Each entry includes revenue, order count, and % share of total revenue. Useful for identifying strongest markets.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      ...businessOnly, ...timeframeField,
      limit: z.number().int().min(1).max(50).optional().describe("Number of locations to return. Defaults to 10."),
    }),
  }, async ({ business_id, timeframe = "last_30_days", limit = 10 }) => {
    try { return mcpResult(await queryGeographicBreakdown(userId, business_id, timeframe, limit)); } catch (err) { return mcpError(err); }
  });

  mcpServer.registerTool("get_daily_trends", {
    title: "Get Daily Trends",
    description: "Return day-by-day revenue, order count, paid revenue, and ad spend for a given timeframe. Use this to spot trends, spikes, or drops over time.",
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ ...businessOnly, ...timeframeField }),
  }, async ({ business_id, timeframe = "last_30_days" }) => {
    try { return mcpResult(await queryDailyTrends(userId, business_id, timeframe)); } catch (err) { return mcpError(err); }
  });

  return mcpServer;
}

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("SouqMetrics MCP API is running."));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── OAuth metadata (RFC 8414) ──────────────────────────────────────────────────
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: "https://mcp.souqmetrics.co",
    authorization_endpoint: "https://mcp.souqmetrics.co/oauth/authorize",
    token_endpoint: "https://mcp.souqmetrics.co/oauth/token",
    mcp_endpoint: "https://mcp.souqmetrics.co/mcp",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["read"],
    token_endpoint_auth_methods_supported: ["none"],
    token_endpoint_auth_signing_alg_values_supported: ["RS256"],
    require_pushed_authorization_requests: false,
    client_registration_types_supported: ["manual"],
  });
});

app.post("/oauth/register", (_req, res) => {
  res.status(400).json({
    error: "invalid_client_metadata",
    error_description: "Dynamic client registration is not supported. Please use client_id: claude-ai-client",
  });
});

app.get("/.well-known/openid-configuration", (_req, res) => {
  res.redirect("/.well-known/oauth-authorization-server");
});

// ── OAuth: Authorize redirect ──────────────────────────────────────────────────
app.get("/oauth/authorize", (req, res) => {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type, scope } = req.query;
  if (!redirect_uri || !redirect_uri.startsWith("https://")) {
    return res.status(400).json({ ok: false, error: "redirect_uri must start with https://" });
  }
  const params = new URLSearchParams();
  if (client_id) params.set("client_id", client_id);
  params.set("redirect_uri", redirect_uri);
  if (state) params.set("state", state);
  if (code_challenge) params.set("code_challenge", code_challenge);
  if (code_challenge_method) params.set("code_challenge_method", code_challenge_method);
  if (response_type) params.set("response_type", response_type);
  if (scope) params.set("scope", scope);
  return res.redirect(302, `https://app.souqmetrics.co/oauth/authorize?${params.toString()}`);
});

// ── OAuth: Token exchange ──────────────────────────────────────────────────────
app.post("/oauth/token", async (req, res) => {
  try {
    console.log("[token] body:", JSON.stringify(req.body));
    const { code, grant_type, redirect_uri, client_id, code_verifier } = req.body;

    if (grant_type !== "authorization_code") {
      return res.status(400).json({ error: "unsupported_grant_type" });
    }
    if (!code) return res.status(400).json({ error: "invalid_request", error_description: "Missing code" });

    const { data: codeRow, error: codeErr } = await supabase
      .from("oauth_codes")
      .select("id, user_id, redirect_uri, expires_at, used_at, code_challenge, code_challenge_method")
      .eq("code", code)
      .maybeSingle();

    if (codeErr) return res.status(500).json({ error: "server_error", error_description: codeErr.message });
    if (!codeRow) return res.status(400).json({ error: "invalid_grant", error_description: "Invalid code" });
    if (codeRow.used_at) return res.status(400).json({ error: "invalid_grant", error_description: "Code already used" });
    if (new Date(codeRow.expires_at) < new Date()) return res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });

    // PKCE verification — skip if no challenge was stored (backwards compat)
    if (codeRow.code_challenge && code_verifier) {
      const hash = createHash("sha256").update(code_verifier).digest("base64url");
      if (hash !== codeRow.code_challenge) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
    }

    await supabase.from("oauth_codes").update({ used_at: new Date().toISOString() }).eq("id", codeRow.id);

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertErr } = await supabase.from("oauth_access_tokens").insert({
      token,
      user_id: codeRow.user_id,
      expires_at: expiresAt,
    });
    if (insertErr) return res.status(500).json({ error: "server_error", error_description: insertErr.message });

    return res.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 7776000,
    });
  } catch (err) {
    console.error("[token] CRASH:", err.stack || err.message);
    return res.status(500).json({ error: "server_error", error_description: err.message });
  }
});

// ── MCP: Streamable HTTP endpoint ─────────────────────────────────────────────
// Single endpoint for all MCP communication. Stateless — a fresh transport and
// McpServer instance is created per request, so this works on Vercel serverless.

app.post("/mcp", async (req, res) => {
  const token = req.headers["authorization"]?.replace("Bearer ", "").trim();
  const userId = await resolveToken(token);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: token ? "Invalid or expired token" : "Missing Authorization header",
    });
  }

  const mcpServer = buildMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no cross-request session state
  });

  res.on("finish", () => transport.close());

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// ── REST: Workspaces ───────────────────────────────────────────────────────────
app.get("/workspace-list-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  try { return res.json(await queryWorkspaces(user_id)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Business Summary ─────────────────────────────────────────────────────
app.get("/business-summary-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryBusinessSummary(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: KPI Metrics ──────────────────────────────────────────────────────────
app.get("/kpi-metrics-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryKpiMetrics(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Channel Breakdown ────────────────────────────────────────────────────
app.get("/channel-breakdown-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryChannelBreakdown(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Top Products ─────────────────────────────────────────────────────────
app.get("/top-products-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  const limit = Number(req.query.limit || 10);
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryTopProducts(user_id, business_id, timeframe, limit)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Payment Breakdown ────────────────────────────────────────────────────
app.get("/payment-breakdown-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryPaymentBreakdown(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Profit Summary ───────────────────────────────────────────────────────
app.get("/profit-summary-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryProfitSummary(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Geographic Breakdown ─────────────────────────────────────────────────
app.get("/geographic-breakdown-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  const limit = Number(req.query.limit || 10);
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryGeographicBreakdown(user_id, business_id, timeframe, limit)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

// ── REST: Daily Trends ─────────────────────────────────────────────────────────
app.get("/daily-trends-by-user", async (req, res) => {
  const user_id = await verifyToken(req, res);
  if (!user_id) return;
  const { business_id, timeframe = "last_30_days" } = req.query;
  if (!business_id) return res.status(400).json({ ok: false, error: "Missing business_id" });
  try { return res.json(await queryDailyTrends(user_id, business_id, timeframe)); }
  catch (err) { return res.status(err.status || 500).json({ ok: false, error: err.message }); }
});

export default app;

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`SouqMetrics API running on port ${PORT}`);
  });
}
