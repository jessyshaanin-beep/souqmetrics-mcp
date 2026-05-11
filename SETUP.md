# SouqMetrics MCP — Setup Guide

## Add to Claude Desktop

Open `~/Library/Application Support/Claude/claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "souqmetrics": {
      "command": "node",
      "args": ["/Users/jessyshaanin/Documents/souqmetrics-mcp/mcp-stdio.js"],
      "env": {
        "MCP_API_KEY": "souqmetrics-secret-123"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the 9 SouqMetrics tools in the tool picker.

## Add to Claude Code (CLI)

```bash
claude mcp add souqmetrics node /Users/jessyshaanin/Documents/souqmetrics-mcp/mcp-stdio.js --env MCP_API_KEY=souqmetrics-secret-123
```

## Add to Claude.ai Connectors

Point the remote connector to:
```
https://souqmetrics-mcp.vercel.app
```
with header `x-api-key: souqmetrics-secret-123`

---

## Available Tools

| Tool | What it does |
|---|---|
| `list_workspaces` | Get all workspaces for a user — run this first |
| `get_business_summary` | Revenue, orders, AOV |
| `get_kpi_metrics` | Full KPI snapshot with period-over-period % changes |
| `get_profit_summary` | Estimated profit, margin, cost breakdown |
| `get_channel_breakdown` | Paid Social vs Organic Social vs Direct/Search |
| `get_top_products` | Top products by revenue |
| `get_payment_breakdown` | Card / COD / Whish / BNPL split |
| `get_geographic_breakdown` | Top cities and countries by revenue |
| `get_daily_trends` | Day-by-day revenue and ad spend |

All tools (except `list_workspaces`) accept `timeframe`: `today`, `last_7_days`, `last_30_days`, `last_90_days`.

## Example Conversation

> "Show me my KPIs for the last 7 days and tell me which products are driving revenue"

Claude will:
1. Call `list_workspaces` to find your business ID
2. Call `get_kpi_metrics` with `timeframe=last_7_days`
3. Call `get_top_products` with `timeframe=last_7_days`
4. Synthesize the results into an insight
