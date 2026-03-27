import "dotenv/config";

const BASE_URL = "https://souqmetrics-mcp.vercel.app";
const API_KEY = process.env.MCP_API_KEY;

async function testListWorkspaces() {
  try {
    const response = await fetch(`${BASE_URL}/workspace-list`, {
      headers: {
        "x-api-key": API_KEY,
      },
    });

    const data = await response.json();

    console.log("\n--- list_workspaces ---");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("\n--- list_workspaces error ---");
    console.error(err.message);
  }
}

async function testBusinessSummary() {
  try {
    const businessId = "e3661b20-d16f-4435-a38f-d7a0c706be4d";
    const timeframe = "last_30_days";

    const url =
      `${BASE_URL}/business-summary?business_id=${encodeURIComponent(businessId)}&timeframe=${encodeURIComponent(timeframe)}`;

    const response = await fetch(url, {
      headers: {
        "x-api-key": API_KEY,
      },
    });

    const data = await response.json();

    console.log("\n--- get_business_summary ---");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("\n--- get_business_summary error ---");
    console.error(err.message);
  }
}

async function run() {
  if (!API_KEY) {
    console.error("Missing MCP_API_KEY in .env");
    process.exit(1);
  }

  await testListWorkspaces();
  await testBusinessSummary();
}

run();