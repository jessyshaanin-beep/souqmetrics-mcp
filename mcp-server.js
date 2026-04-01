import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "SouqMetrics",
  version: "0.1.0",
});

const BASE_URL = "https://souqmetrics-mcp.vercel.app";
const API_KEY = process.env.MCP_API_KEY;

server.tool(
  "list_workspaces",
  "Return all workspaces available to the authenticated SouqMetrics user.",
  z.object({
    user_id: z.string().describe("Supabase user ID")
  }),
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
      };

    } catch (err) {

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: err.message,
            }),
          },
        ],
      };

    }
  }
);

server.tool(
  "get_business_summary",
  "Return total revenue, total orders, and average order value for a selected workspace and timeframe.",
  {
    user_id: {
      type: "string",
      description: "Supabase user ID"
    },
    business_id: {
      type: "string",
      description: "Workspace business ID"
    },
    timeframe: {
      type: "string",
      description: "today, last_7_days, or last_30_days"
    }
  },

  async ({
    user_id,
    business_id,
    timeframe = "last_30_days"
  }) => {

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
      };

    } catch (err) {

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: err.message,
            }),
          },
        ],
      };

    }
  }
);

export default server;