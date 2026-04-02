import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v3";

const server = new McpServer({
  name: "SouqMetrics",
  version: "0.1.0",
});

const BASE_URL = "https://souqmetrics-mcp.vercel.app";
const API_KEY = process.env.MCP_API_KEY;

server.registerTool(
  "list_workspaces",
  {
    title: "List Workspaces",
    description: "Return all workspaces available to the authenticated SouqMetrics user.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
    }),
  },
  async ({ user_id }) => {
    try {
      const url =
        `${BASE_URL}/workspace-list-by-user?user_id=${encodeURIComponent(user_id)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_business_summary",
  {
    title: "Get Business Summary",
    description: "Return total revenue, total orders, and average order value for a selected workspace and timeframe.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
      business_id: z.string().describe("Workspace business ID"),
      timeframe: z.string().optional().describe("today, last_7_days, or last_30_days"),
    }),
  },
  async ({ user_id, business_id, timeframe = "last_30_days" }) => {
    try {
      const url =
        `${BASE_URL}/business-summary-by-user` +
        `?user_id=${encodeURIComponent(user_id)}` +
        `&business_id=${encodeURIComponent(business_id)}` +
        `&timeframe=${encodeURIComponent(timeframe)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_profit_summary",
  {
    title: "Get Profit Summary",
    description: "Return estimated profit and margin for a selected workspace.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
      business_id: z.string().describe("Workspace business ID"),
    }),
  },
  async ({ user_id, business_id }) => {
    try {
      const url =
        `${BASE_URL}/profit-summary-by-user` +
        `?user_id=${encodeURIComponent(user_id)}` +
        `&business_id=${encodeURIComponent(business_id)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_channel_breakdown",
  {
    title: "Get Channel Breakdown",
    description: "Return revenue and orders grouped by Paid Social, Organic Social, and Direct/Search.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
      business_id: z.string().describe("Workspace business ID"),
      timeframe: z.string().optional().describe("today, last_7_days, or last_30_days"),
    }),
  },
  async ({ user_id, business_id, timeframe = "last_30_days" }) => {
    try {
      const url =
        `${BASE_URL}/channel-breakdown-by-user` +
        `?user_id=${encodeURIComponent(user_id)}` +
        `&business_id=${encodeURIComponent(business_id)}` +
        `&timeframe=${encodeURIComponent(timeframe)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_top_products",
  {
    title: "Get Top Products",
    description: "Return the top-performing products by revenue for a selected workspace and timeframe.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
      business_id: z.string().describe("Workspace business ID"),
      timeframe: z.string().optional().describe("today, last_7_days, or last_30_days"),
      limit: z.number().optional().describe("Maximum number of products to return"),
    }),
  },
  async ({ user_id, business_id, timeframe = "last_30_days", limit = 5 }) => {
    try {
      const url =
        `${BASE_URL}/top-products-by-user` +
        `?user_id=${encodeURIComponent(user_id)}` +
        `&business_id=${encodeURIComponent(business_id)}` +
        `&timeframe=${encodeURIComponent(timeframe)}` +
        `&limit=${encodeURIComponent(limit)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_payment_breakdown",
  {
    title: "Get Payment Breakdown",
    description: "Return revenue and orders grouped by COD, Card, and BNPL.",
    inputSchema: z.object({
      user_id: z.string().describe("Supabase user ID"),
      business_id: z.string().describe("Workspace business ID"),
    }),
  },
  async ({ user_id, business_id }) => {
    try {
      const url =
        `${BASE_URL}/payment-breakdown-by-user` +
        `?user_id=${encodeURIComponent(user_id)}` +
        `&business_id=${encodeURIComponent(business_id)}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    } catch (err) {
      const errorData = {
        ok: false,
        error: err.message,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData),
          },
        ],
        structuredContent: errorData,
        isError: true,
      };
    }
  }
);

export default server;