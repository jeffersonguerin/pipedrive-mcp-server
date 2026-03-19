// src/index.ts — Pipedrive MCP Server for Deno v1.5.0 (stdio transport)
//
// Required env vars:
//   PIPEDRIVE_API_TOKEN  — Personal API token
//                          (Settings → Personal preferences → API)
//   PIPEDRIVE_DOMAIN     — Subdomain ONLY, no dots, no .pipedrive.com suffix
//                          e.g. mycompany.pipedrive.com → PIPEDRIVE_DOMAIN=mycompany
//
// Run:
//   deno run --allow-net --allow-env=PIPEDRIVE_API_TOKEN,PIPEDRIVE_DOMAIN src/index.ts
//
// Claude Code config (~/.claude.json → "mcpServers"):
//   "pipedrive": {
//     "command": "deno",
//     "args": [
//       "run", "--allow-net",
//       "--allow-env=PIPEDRIVE_API_TOKEN,PIPEDRIVE_DOMAIN",
//       "/absolute/path/to/pipedrive-mcp-server/src/index.ts"
//     ],
//     "env": {
//       "PIPEDRIVE_API_TOKEN": "your_token_here",
//       "PIPEDRIVE_DOMAIN": "yourcompany"
//     }
//   }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.ts";
import { registerDealTools } from "./tools/deals.ts";
import { registerDealExtraTools } from "./tools/deals_extra.ts";
import { registerPersonTools } from "./tools/persons.ts";
import { registerOrganizationTools } from "./tools/organizations.ts";
import { registerActivityTools } from "./tools/activities.ts";
import { registerPipelineTools } from "./tools/pipelines.ts";
import { registerPipelineExtraTools } from "./tools/pipelines_extra.ts";
import { registerLeadTools } from "./tools/leads.ts";
import { registerLeadLabelTools } from "./tools/lead_labels.ts";
import { registerNoteTools } from "./tools/notes.ts";
import { registerUserTools } from "./tools/users.ts";
import { registerUserExtraTools } from "./tools/users_extra.ts";
import { registerProductTools } from "./tools/products.ts";
import { registerFilterTools } from "./tools/filters.ts";
import { registerFileTools } from "./tools/files.ts";
import { registerFieldTools } from "./tools/fields.ts";
import { registerContactExtraTools } from "./tools/contacts_extra.ts";
import { registerRemainingTools } from "./tools/remaining.ts";
import { registerUtilityTools } from "./tools/utilities.ts";

// ─── Validate environment ─────────────────────────────────────────────────────
const apiToken = Deno.env.get("PIPEDRIVE_API_TOKEN");
const domain   = Deno.env.get("PIPEDRIVE_DOMAIN");

if (!apiToken) {
  console.error("[pipedrive-mcp] FATAL: PIPEDRIVE_API_TOKEN not set.");
  console.error("[pipedrive-mcp] Get it: Pipedrive → Settings → Personal preferences → API");
  Deno.exit(1);
}
if (!domain) {
  console.error("[pipedrive-mcp] FATAL: PIPEDRIVE_DOMAIN not set.");
  console.error("[pipedrive-mcp] Use subdomain only — e.g. 'mycompany' from mycompany.pipedrive.com");
  Deno.exit(1);
}

// ─── Initialize ───────────────────────────────────────────────────────────────
// createClient validates domain format (alphanumeric + hyphens only) at startup
const client = createClient({ apiToken, companyDomain: domain });
const server = new McpServer({ name: "pipedrive-mcp-server", version: "1.5.0" });

// ─── Register Tools ───────────────────────────────────────────────────────────
// v2: cursor pagination, RFC3339, PATCH, nested custom_fields, Bearer auth
registerDealTools(server, client);           // 22: CRUD+search+products(add/update/delete)+participants+followers+convert+bulk+archived+merge+duplicate
registerDealExtraTools(server, client);      // 17: summary(2)+timeline(2)+discounts(4)+installments(4)+changelog+files+updates+mail+permitted
registerPersonTools(server, client);         // 10: CRUD+search+merge+followers
registerOrganizationTools(server, client);   // 10: CRUD+search+merge+followers
registerActivityTools(server, client);       //  5: CRUD (stable since Mar 2025)
registerPipelineTools(server, client);       // 10: Pipelines(5) + Stages(5 w/ order_nr sort)
registerPipelineExtraTools(server, client);  //  2: conversion_stats + movement_stats
registerProductTools(server, client);        // 15: CRUD+search+duplicate+variations(CRUD)+deals+followers

// v1: no v2 equivalent — maintained by Pipedrive as of Mar 2026
registerLeadTools(server, client);           //  9: CRUD+search+convert+archived (Jul 2025 breaking change handled)
registerLeadLabelTools(server, client);      //  4: get+create+update+delete lead labels (UUID-based)
registerNoteTools(server, client);           // 10: CRUD+comments CRUD (update uses HTTP PUT)
registerFilterTools(server, client);         //  6: CRUD + helpers + bulk delete
registerFileTools(server, client);           //  3: list+get+delete
registerUserTools(server, client);           //  4: me+list+globalSearch+fieldSearch
registerUserExtraTools(server, client);      //  3: get_user+permissions+followers

// v1.1.0: Fields CRUD + Options management (v2 Fields API, released Dec 2025)
registerFieldTools(server, client);          // 34: 4 entities × 7 (get/create/update/delete/addOpts/updateOpts/deleteOpts) + activityField(1) + activityTypes(5: get/create/update/delete/bulkDelete)

// v1.3.0: Person + Organization sub-resources (changelog, files, updates, follower changelog, mail, permitted, person products)
registerContactExtraTools(server, client);   // 13: 6 per entity × 2 + 1 person-only (products)

// v1.5.0: All remaining endpoints — follower changelogs, bulk ops, pictures, images, remote files, permitted users
registerRemainingTools(server, client);      // 17: deal(4)+person(2)+product(5)+lead(1)+files(3)+filters(1)+users(1)

// Discovery / utility (list endpoints for reference data)
registerUtilityTools(server, client);        //  9: activityTypes+currencies+dealFields+activityFields+personFields+orgFields+productFields+leadLabels+leadSources

// Total: 203 tools

// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

// Logs go to stderr — stdout is reserved for MCP protocol messages
console.error(`[pipedrive-mcp] v1.5.0 ready — https://${domain}.pipedrive.com`);
console.error(`[pipedrive-mcp] 203 tools across 22 API entities — see README.md for full inventory`);
