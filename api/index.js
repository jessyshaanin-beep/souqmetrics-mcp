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

app.get("/business-summary", async (req, res) => {
  try {

    // For now we hardcode a test business
    // Later this will come from authentication

    const testBusinessId = "e3661b20-d16f-4435-a38f-d7a0c706be4d";

    const { data, error } = await supabase
      .from("orders")
      .select("order_total")
      .eq("business_id", testBusinessId);

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

  res.json({ ok: true });
});

export default app;