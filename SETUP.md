# SouqMetrics MCP — Setup Guide

## Authentication

SouqMetrics uses OAuth 2.0 to authenticate Claude. You need an access token before using any tool.

### Get an access token

1. Visit **[https://app.souqmetrics.co/oauth/authorize](https://app.souqmetrics.co/oauth/authorize)** (or follow the link Claude provides)
2. Log in with your SouqMetrics account
3. Click **Allow Access** on the consent screen
4. Copy the `code` from the redirect URL and exchange it for a token:

```bash
curl -X POST https://souqmetrics-mcp.vercel.app/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"authorization_code","code":"<code>"}'
```

Response:
```json
{
  "access_token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": 7776000
}
```

Tokens are valid for **90 days**.

---

## Add to Claude Desktop

Open `~/Library/Application Support/Claude/claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "souqmetrics": {
      "command": "node",
      "args": ["/path/to/souqmetrics-mcp/mcp-stdio.js"],
      "env": {
        "SOUQMETRICS_ACCESS_TOKEN": "your-access-token-here",
        "SOUQMETRICS_API_URL": "https://souqmetrics-mcp.vercel.app"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the 9 SouqMetrics tools in the tool picker.

---

## Add to Claude Code (CLI)

```bash
claude mcp add souqmetrics node /path/to/souqmetrics-mcp/mcp-stdio.js \
  --env SOUQMETRICS_ACCESS_TOKEN=your-access-token-here \
  --env SOUQMETRICS_API_URL=https://souqmetrics-mcp.vercel.app
```

---

## Add to Claude.ai as a Remote Connector

Point the remote connector at:
```
https://souqmetrics-mcp.vercel.app
```

Claude.ai will initiate the OAuth flow automatically using the `/oauth/authorize` and `/oauth/token` endpoints.

---

## Available Tools

| Tool | What it does |
|---|---|
| `list_workspaces` | Get all workspaces you have access to — call this first |
| `get_business_summary` | Revenue, orders, AOV |
| `get_kpi_metrics` | Full KPI snapshot with period-over-period % changes |
| `get_profit_summary` | Estimated profit, margin, cost breakdown |
| `get_channel_breakdown` | Paid Social vs Organic Social vs Direct/Search |
| `get_top_products` | Top products by revenue |
| `get_payment_breakdown` | Card / COD / Whish / BNPL split |
| `get_geographic_breakdown` | Top cities and countries by revenue |
| `get_daily_trends` | Day-by-day revenue and ad spend |

All tools (except `list_workspaces`) accept an optional `timeframe`: `today`, `last_7_days`, `last_30_days`, `last_90_days` (default: `last_30_days`).

---

## Example Conversation

> "Show me my KPIs for the last 7 days and tell me which products are driving revenue"

Claude will:
1. Call `list_workspaces` to find your business ID
2. Call `get_kpi_metrics` with `timeframe=last_7_days`
3. Call `get_top_products` with `timeframe=last_7_days`
4. Synthesize the results into an insight
