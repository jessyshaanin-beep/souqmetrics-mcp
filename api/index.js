import express from "express";
import { createClient } from "@supabase/supabase-js";
import { TEST_BUSINESS_ID, getStartDateFromTimeframe } from "../lib/helpers.js";

const app = express();
app.use(express.json());

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

export default app;