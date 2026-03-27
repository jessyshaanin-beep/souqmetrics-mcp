# SouqMetrics MCP v1 Tools

## 1. list_workspaces
Description:
Return all workspaces available to the authenticated SouqMetrics user.

Inputs:
- none

Output:
- workspaces: array of
  - id
  - name
  - currency

Powered by:
- /workspace-list


## 2. get_workspace_members
Description:
Return the members of a selected workspace.

Inputs:
- business_id (string, required)

Output:
- members: array of
  - email
  - role
  - joined_at

Powered by:
- /workspace-members


## 3. get_business_summary
Description:
Return total revenue, total orders, and average order value for a selected workspace and timeframe.

Inputs:
- business_id (string, required)
- timeframe (string, optional: today, last_7_days, last_30_days)

Output:
- total_revenue
- total_orders
- average_order_value
- timeframe

Powered by:
- /business-summary


## 4. get_channel_performance
Description:
Return revenue grouped by channel for a selected workspace and timeframe.

Inputs:
- business_id (string, required)
- timeframe (string, optional: today, last_7_days, last_30_days)

Output:
- channels object
- timeframe

Powered by:
- /channel-performance


## 5. get_top_products
Description:
Return top-performing products by revenue for a selected workspace and timeframe.

Inputs:
- business_id (string, required)
- timeframe (string, optional: today, last_7_days, last_30_days)
- limit (number, optional)

Output:
- products array
- timeframe

Powered by:
- /top-products


## 6. get_payment_breakdown
Description:
Return payment method breakdown for a selected workspace and timeframe.

Inputs:
- business_id (string, required)
- timeframe (string, optional: today, last_7_days, last_30_days)

Output:
- payment_methods object
- timeframe

Powered by:
- /payment-breakdown