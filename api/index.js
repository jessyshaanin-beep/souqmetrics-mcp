import express from "express";
import { createClient } from "@supabase/supabase-js";

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

    const testBusinessId = "e3661b20-d16f-4435-a38f-d7a0c706be4d";

    // Get timeframe from URL
    const timeframe = req.query.timeframe || "last_30_days";

    // Create date range
    const now = new Date();
    let startDate;

    if (timeframe === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    }

    else if (timeframe === "last_7_days") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    }

    else if (timeframe === "last_30_days") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
    }

    else {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
    }

    const { data, error } = await supabase
      .from("orders")
      .select("order_total, order_date")
      .eq("business_id", testBusinessId)
      .gte("order_date", startDate.toISOString());

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
export default app;