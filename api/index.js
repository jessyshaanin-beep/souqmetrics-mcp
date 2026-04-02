import express from "express";
import { createClient } from "@supabase/supabase-js";
import { TEST_BUSINESS_ID, getStartDateFromTimeframe } from "../lib/helpers.js";

const app = express();
app.use(express.json());


// 🔐 API Key Protection Middleware

app.use((req, res, next) => {

  // Allow health check without API key
  if (req.path === "/" || req.path === "/health") {
    return next();
  }

  const apiKey =
    req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      error: "Missing API key"
    });
  }

  if (apiKey !== process.env.MCP_API_KEY) {
    return res.status(403).json({
      ok: false,
      error: "Invalid API key"
    });
  }

  next();

});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get("/", (_req, res) => {
  res.send("SouqMetrics MCP starter is running.");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/business-summary", async (req, res) => {
  try {

    const testBusinessId =
  req.query.business_id || TEST_BUSINESS_ID;

   const timeframe = req.query.timeframe || "last_30_days";
const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("order_total, order_date")
      .eq("business_id", testBusinessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const totalRevenue =
      data?.reduce((sum, o) => sum + Number(o.order_total), 0) || 0;

    const totalOrders = data?.length || 0;

    const averageOrderValue =
      totalOrders > 0
        ? totalRevenue / totalOrders
        : 0;

    return res.json({
      ok: true,
      timeframe,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      average_order_value: averageOrderValue,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/channel-performance", async (req, res) => {
  try {

   const testBusinessId =
  req.query.business_id || TEST_BUSINESS_ID;

   const timeframe = req.query.timeframe || "last_30_days";
const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("channel, order_total, order_date")
      .eq("business_id", testBusinessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    // Group revenue by channel
    const channelTotals = {};

    data.forEach(order => {

      const channel =
        order.channel || "direct";

      if (!channelTotals[channel]) {
        channelTotals[channel] = 0;
      }

      channelTotals[channel] +=
        Number(order.order_total);

    });

    return res.json({
      ok: true,
      timeframe,
      channels: channelTotals,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});


app.get("/top-products", async (req, res) => {
  try {

   const testBusinessId =
  req.query.business_id || TEST_BUSINESS_ID;

    const timeframe = req.query.timeframe || "last_30_days";
const limit = Number(req.query.limit || 10);
const startDate = getStartDateFromTimeframe(timeframe);

    // First get orders for this business in timeframe
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_date")
      .eq("business_id", testBusinessId)
      .gte("order_date", startDate);

    if (ordersError) {
      return res.status(500).json({
        ok: false,
        error: ordersError.message,
      });
    }

    const orderIds = (orders || []).map(order => order.id);

    if (orderIds.length === 0) {
      return res.json({
        ok: true,
        timeframe,
        products: [],
      });
    }

    // Then get matching order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, product_name, revenue")
      .in("order_id", orderIds);

    if (itemsError) {
      return res.status(500).json({
        ok: false,
        error: itemsError.message,
      });
    }

    const productTotals = {};

    (items || []).forEach(item => {
      const productName = item.product_name || "Unnamed Product";
      const revenue = Number(item.revenue || 0);

      if (!productTotals[productName]) {
        productTotals[productName] = {
          product_name: productName,
          revenue: 0,
        };
      }

      productTotals[productName].revenue += revenue;
    });

    const products = Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return res.json({
      ok: true,
      timeframe,
      products,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/payment-breakdown", async (req, res) => {
  try {
    const testBusinessId =
  req.query.business_id || TEST_BUSINESS_ID;

    const timeframe = req.query.timeframe || "last_30_days";
const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("payment_method, order_total, order_date")
      .eq("business_id", testBusinessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const breakdown = {
      card: { orders: 0, revenue: 0 },
      cod: { orders: 0, revenue: 0 },
      whish: { orders: 0, revenue: 0 },
      bnpl: { orders: 0, revenue: 0 },
      other: { orders: 0, revenue: 0 }
    };

    (data || []).forEach(order => {
      const method = (order.payment_method || "").toLowerCase();
      const revenue = Number(order.order_total || 0);

      if (method === "card") {
        breakdown.card.orders += 1;
        breakdown.card.revenue += revenue;
      } else if (method === "cod") {
        breakdown.cod.orders += 1;
        breakdown.cod.revenue += revenue;
      } else if (method === "whish") {
        breakdown.whish.orders += 1;
        breakdown.whish.revenue += revenue;
      } else if (method === "bnpl") {
        breakdown.bnpl.orders += 1;
        breakdown.bnpl.revenue += revenue;
      } else {
        breakdown.other.orders += 1;
        breakdown.other.revenue += revenue;
      }
    });

    return res.json({
      ok: true,
      timeframe,
      payment_methods: breakdown,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/workspace-list", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("businesses")
      .select("id, business_name, currency");

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const workspaces = (data || []).map(b => ({
      id: b.id,
      name: b.business_name,
      currency: b.currency || "USD"
    }));

    return res.json({
      ok: true,
      workspaces
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/workspace-members", async (req, res) => {
  try {
    const businessId = req.query.business_id || TEST_BUSINESS_ID;

    const { data, error } = await supabase
      .from("workspace_members")
      .select("email, role, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const members = (data || []).map(member => ({
      email: member.email,
      role: member.role,
      joined_at: member.created_at
    }));

    return res.json({
      ok: true,
      members
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/workspace-list-by-user", async (req, res) => {
  try {
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id"
      });
    }

    // Step 1: get memberships for this user
    const { data: memberships, error: membershipsError } = await supabase
      .from("workspace_members")
      .select("business_id")
      .eq("user_id", userId);

    if (membershipsError) {
      return res.status(500).json({
        ok: false,
        error: membershipsError.message
      });
    }

    const businessIds = (memberships || []).map(m => m.business_id);

    if (businessIds.length === 0) {
      return res.json({
        ok: true,
        workspaces: []
      });
    }

    // Step 2: get businesses for those memberships
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, business_name, currency")
      .in("id", businessIds);

    if (businessesError) {
      return res.status(500).json({
        ok: false,
        error: businessesError.message
      });
    }

    const workspaces = (businesses || []).map(b => ({
      id: b.id,
      name: b.business_name,
      currency: b.currency || "USD"
    }));

    return res.json({
      ok: true,
      workspaces
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/business-summary-by-user", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const businessId = req.query.business_id;
    const timeframe = req.query.timeframe || "last_30_days";

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id"
      });
    }

    if (!businessId) {
      return res.status(400).json({
        ok: false,
        error: "Missing business_id"
      });
    }

    // Step 1: verify user belongs to workspace
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (membershipError) {
      return res.status(500).json({
        ok: false,
        error: membershipError.message
      });
    }

    if (!membership) {
      return res.status(403).json({
        ok: false,
        error: "User does not have access to this workspace"
      });
    }

    // Step 2: get date range
    const startDate = getStartDateFromTimeframe(timeframe);

    // Step 3: get analytics
    const { data, error } = await supabase
      .from("orders")
      .select("order_total, order_date")
      .eq("business_id", businessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }

    const totalRevenue =
      data?.reduce((sum, o) => sum + Number(o.order_total), 0) || 0;

    const totalOrders = data?.length || 0;

    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.json({
      ok: true,
      timeframe,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      average_order_value: averageOrderValue
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/channel-performance-by-user", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const businessId = req.query.business_id;
    const timeframe = req.query.timeframe || "last_30_days";

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id"
      });
    }

    if (!businessId) {
      return res.status(400).json({
        ok: false,
        error: "Missing business_id"
      });
    }

    // Step 1: verify user belongs to workspace
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (membershipError) {
      return res.status(500).json({
        ok: false,
        error: membershipError.message
      });
    }

    if (!membership) {
      return res.status(403).json({
        ok: false,
        error: "User does not have access to this workspace"
      });
    }

    // Step 2: get date range
    const startDate = getStartDateFromTimeframe(timeframe);

    // Step 3: get channel analytics
    const { data, error } = await supabase
      .from("orders")
      .select("channel, order_total, order_date")
      .eq("business_id", businessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }

    const channelTotals = {};

    (data || []).forEach(order => {
      const channel = order.channel || "direct";

      if (!channelTotals[channel]) {
        channelTotals[channel] = 0;
      }

      channelTotals[channel] += Number(order.order_total || 0);
    });

    return res.json({
      ok: true,
      timeframe,
      channels: channelTotals
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/top-products-by-user", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const businessId = req.query.business_id;
    const timeframe = req.query.timeframe || "last_30_days";
    const limit = Number(req.query.limit || 10);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id"
      });
    }

    if (!businessId) {
      return res.status(400).json({
        ok: false,
        error: "Missing business_id"
      });
    }

    // Step 1: verify user belongs to workspace
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (membershipError) {
      return res.status(500).json({
        ok: false,
        error: membershipError.message
      });
    }

    if (!membership) {
      return res.status(403).json({
        ok: false,
        error: "User does not have access to this workspace"
      });
    }

    // Step 2: get date range
    const startDate = getStartDateFromTimeframe(timeframe);

    // Step 3: get orders in timeframe
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_date")
      .eq("business_id", businessId)
      .gte("order_date", startDate);

    if (ordersError) {
      return res.status(500).json({
        ok: false,
        error: ordersError.message
      });
    }

    const orderIds = (orders || []).map(order => order.id);

    if (orderIds.length === 0) {
      return res.json({
        ok: true,
        timeframe,
        products: []
      });
    }

    // Step 4: get matching order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, product_name, revenue")
      .in("order_id", orderIds);

    if (itemsError) {
      return res.status(500).json({
        ok: false,
        error: itemsError.message
      });
    }

    const productTotals = {};

    (items || []).forEach(item => {
      const productName = item.product_name || "Unnamed Product";
      const revenue = Number(item.revenue || 0);

      if (!productTotals[productName]) {
        productTotals[productName] = {
          product_name: productName,
          revenue: 0
        };
      }

      productTotals[productName].revenue += revenue;
    });

    const products = Object.values(productTotals)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return res.json({
      ok: true,
      timeframe,
      products
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/payment-breakdown-by-user", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const businessId = req.query.business_id;
    const timeframe = req.query.timeframe || "last_30_days";

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id"
      });
    }

    if (!businessId) {
      return res.status(400).json({
        ok: false,
        error: "Missing business_id"
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (membershipError) {
      return res.status(500).json({
        ok: false,
        error: membershipError.message
      });
    }

    if (!membership) {
      return res.status(403).json({
        ok: false,
        error: "User does not have access to this workspace"
      });
    }

    const startDate = getStartDateFromTimeframe(timeframe);

    const { data, error } = await supabase
      .from("orders")
      .select("payment_method, order_total, order_date")
      .eq("business_id", businessId)
      .gte("order_date", startDate);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message
      });
    }

    const breakdown = {
      card: { orders: 0, revenue: 0 },
      cod: { orders: 0, revenue: 0 },
      whish: { orders: 0, revenue: 0 },
      bnpl: { orders: 0, revenue: 0 },
      other: { orders: 0, revenue: 0 }
    };

    (data || []).forEach(order => {
      const method = (order.payment_method || "").toLowerCase();
      const revenue = Number(order.order_total || 0);

      if (method === "card") {
        breakdown.card.orders += 1;
        breakdown.card.revenue += revenue;
      } else if (method === "cod") {
        breakdown.cod.orders += 1;
        breakdown.cod.revenue += revenue;
      } else if (method === "whish") {
        breakdown.whish.orders += 1;
        breakdown.whish.revenue += revenue;
      } else if (method === "bnpl") {
        breakdown.bnpl.orders += 1;
        breakdown.bnpl.revenue += revenue;
      } else {
        breakdown.other.orders += 1;
        breakdown.other.revenue += revenue;
      }
    });

    return res.json({
      ok: true,
      timeframe,
      payment_methods: breakdown
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/channel-breakdown-by-user", async (req, res) => {
  try {
    const { user_id, business_id, timeframe = "last_30_days" } = req.query;

    if (!user_id || !business_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id or business_id",
      });
    }

    // Date filtering logic (same style as summary)

    let dateFilter = "";

    if (timeframe === "today") {
      dateFilter = "order_date >= CURRENT_DATE";
    }

    if (timeframe === "last_7_days") {
      dateFilter = "order_date >= CURRENT_DATE - INTERVAL '7 days'";
    }

    if (timeframe === "last_30_days") {
      dateFilter = "order_date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const { data, error } = await supabase
      .from("orders")
      .select("order_total, utm_source, utm_medium")
      .eq("business_id", business_id);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    // Channel classification logic

    const channels = {
      paid_social: { revenue: 0, orders: 0 },
      organic_social: { revenue: 0, orders: 0 },
      direct_search: { revenue: 0, orders: 0 },
    };

    for (const order of data || []) {
      const revenue = Number(order.order_total) || 0;

      const source = (order.utm_source || "").toLowerCase();
      const medium = (order.utm_medium || "").toLowerCase();

      let bucket = "direct_search";

      if (medium === "paid" && source.includes("social")) {
        bucket = "paid_social";
      }

      else if (medium === "social") {
        bucket = "organic_social";
      }

      channels[bucket].revenue += revenue;
      channels[bucket].orders += 1;
    }

    return res.json({
      ok: true,
      channels,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.get("/top-products-by-user", async (req, res) => {
  try {
    const { user_id, business_id, timeframe = "last_30_days" } = req.query;

    if (!user_id || !business_id) {
      return res.status(400).json({
        ok: false,
        error: "Missing user_id or business_id",
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("product_name, order_total")
      .eq("business_id", business_id);

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const productMap = {};

    for (const order of data || []) {

      const name =
        order.product_name || "Unknown Product";

      const revenue =
        Number(order.order_total) || 0;

      if (!productMap[name]) {
        productMap[name] = {
          product_name: name,
          revenue: 0,
          orders: 0,
        };
      }

      productMap[name].revenue += revenue;
      productMap[name].orders += 1;
    }

    const products =
      Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    return res.json({
      ok: true,
      products,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default app;