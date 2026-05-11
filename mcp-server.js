import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";

const server = new McpServer({
  name: "SouqMetrics",
  version: "1.0.0",
  description:
    "Analytics tools for SouqMetrics — query revenue, orders, channels, products, geography, and ad performance for your ecommerce workspace.",
});

const BASE_URL =
  process.env.SOUQMETRICS_API_URL || "https://souqmetrics-mcp.vercel.app";
const ACCESS_TOKEN = process.env.SOUQMETRICS_ACCESS_TOKEN;

// ── Shared fetch helper ────────────────────────────────────────────────────────

async function callApi(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  const data = await response.json();

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError: !data.ok,
  };
}

function errorResult(err) {
  const data = { ok: false, error: err.message };
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data,
    isError: true,
  };
}

// ── Shared input schemas ───────────────────────────────────────────────────────

const businessOnly = {
  business_id: z.string().describe("Workspace / business ID (from list_workspaces)"),
};

const timeframeField = {
  timeframe: z
    .enum(["today", "last_7_days", "last_30_days", "last_90_days"])
    .optional()
    .describe("Time window. Defaults to last_30_days."),
};

// ── Tool: list_workspaces ──────────────────────────────────────────────────────

server.registerTool(
  "list_workspaces",
  {
    title: "List Workspaces",
    description:
      "Return all workspaces the authenticated SouqMetrics user has access to. Always call this first to get valid business_id values before calling any other tool.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      return await callApi("/workspace-list-by-user");
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_business_summary ─────────────────────────────────────────────────

server.registerTool(
  "get_business_summary",
  {
    title: "Get Business Summary",
    description:
      "Return total revenue, total orders, and average order value for a workspace over a given timeframe.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/business-summary-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_kpi_metrics ──────────────────────────────────────────────────────

server.registerTool(
  "get_kpi_metrics",
  {
    title: "Get KPI Metrics",
    description:
      "Return full KPI report: revenue, orders, AOV, ad spend, ROAS, CPA, paid revenue — plus percentage changes vs the prior equivalent period. Use this for performance snapshots and trend analysis.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/kpi-metrics-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_profit_summary ───────────────────────────────────────────────────

server.registerTool(
  "get_profit_summary",
  {
    title: "Get Profit Summary",
    description:
      "Return estimated profit, margin %, and cost breakdown (COGS, delivery, fixed costs) for a workspace. Requires the user to have configured cost settings in SouqMetrics.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/profit-summary-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_channel_breakdown ────────────────────────────────────────────────

server.registerTool(
  "get_channel_breakdown",
  {
    title: "Get Channel Breakdown",
    description:
      "Return revenue and order counts grouped into three buckets: Paid Social (Meta, TikTok, Google), Organic Social (Instagram, Facebook, TikTok organic), and Direct / Search. Use this to understand channel mix.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/channel-breakdown-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_top_products ─────────────────────────────────────────────────────

server.registerTool(
  "get_top_products",
  {
    title: "Get Top Products",
    description:
      "Return the top-performing products ranked by revenue for a given timeframe. Each product includes total revenue and order count.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Number of products to return. Defaults to 10."),
    }),
  },
  async ({ business_id, timeframe = "last_30_days", limit = 10 }) => {
    try {
      return await callApi(
        `/top-products-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}` +
          `&limit=${encodeURIComponent(limit)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_payment_breakdown ────────────────────────────────────────────────

server.registerTool(
  "get_payment_breakdown",
  {
    title: "Get Payment Breakdown",
    description:
      "Return revenue and order counts grouped by payment method: Card, COD (cash on delivery), Whish, BNPL (Tabby / Tamara), and Other.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/payment-breakdown-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_geographic_breakdown ─────────────────────────────────────────────

server.registerTool(
  "get_geographic_breakdown",
  {
    title: "Get Geographic Breakdown",
    description:
      "Return top locations (country + city) ranked by revenue. Each entry includes revenue, order count, and % share of total revenue. Useful for identifying strongest markets.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Number of locations to return. Defaults to 10."),
    }),
  },
  async ({ business_id, timeframe = "last_30_days", limit = 10 }) => {
    try {
      return await callApi(
        `/geographic-breakdown-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}` +
          `&limit=${encodeURIComponent(limit)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── Tool: get_daily_trends ─────────────────────────────────────────────────────

server.registerTool(
  "get_daily_trends",
  {
    title: "Get Daily Trends",
    description:
      "Return day-by-day revenue, order count, paid revenue, and ad spend for a given timeframe. Use this to spot trends, spikes, or drops over time.",
    inputSchema: z.object({
      ...businessOnly,
      ...timeframeField,
    }),
  },
  async ({ business_id, timeframe = "last_30_days" }) => {
    try {
      return await callApi(
        `/daily-trends-by-user` +
          `?business_id=${encodeURIComponent(business_id)}` +
          `&timeframe=${encodeURIComponent(timeframe)}`
      );
    } catch (err) {
      return errorResult(err);
    }
  }
);

export default server;
