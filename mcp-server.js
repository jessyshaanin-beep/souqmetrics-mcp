import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "SouqMetrics",
  version: "0.1.0",
});

server.tool(
  "list_workspaces",
  "Return all workspaces available to the authenticated SouqMetrics user.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool: "list_workspaces",
            message: "Tool registered successfully"
          })
        }
      ]
    };
  }
);

server.tool(
  "get_business_summary",
  "Return total revenue, total orders, and average order value for a selected workspace and timeframe.",
  {
    business_id: { type: "string", description: "Workspace business ID" },
    timeframe: { type: "string", description: "today, last_7_days, or last_30_days" }
  },
  async ({ business_id, timeframe }) => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool: "get_business_summary",
            business_id,
            timeframe,
            message: "Tool registered successfully"
          })
        }
      ]
    };
  }
);

export default server;