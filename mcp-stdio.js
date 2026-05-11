#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env from the directory this file lives in, regardless of CWD.
// quiet: true suppresses stdout tips that would corrupt the JSON-RPC stream.
const __dirname = dirname(fileURLToPath(import.meta.url));
const { config } = createRequire(import.meta.url)("dotenv");
config({ path: join(__dirname, ".env"), quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import server from "./mcp-server.js";

const transport = new StdioServerTransport();
await server.connect(transport);
