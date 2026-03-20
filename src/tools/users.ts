// src/tools/users.ts — Pipedrive Users API v1 + Global Search v2
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerUserTools(server: McpServer, client: PipedriveClient): void {

  server.registerTool("pipedrive_get_current_user", {
    title: "Get Current User",
    description: `Get info about the authenticated user (v1 API).

Returns: id, name, email, phone, lang, timezone_name, timezone_offset,
company_id, company_name, company_domain, is_admin, active_flag, role_id, etc.
Use this to discover your own user_id (owner_id) and company domain.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<SingleResponse<unknown>>("/api/v1/users/me");
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_list_users", {
    title: "List Users",
    description: `List all users in the company account (v1 API). Admin access required.

Returns user IDs, names, emails, roles. Useful for finding owner_id values for other tools.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/users");
      return ok(`${data.data?.length ?? 0} user(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_search", {
    title: "Global Search",
    description: `Search across all entity types at once (v2 itemSearch API).

entity_type: deal | lead | person | organization | product | project (omit for all types).

match parameter controls speed vs breadth:
  - exact: fastest — only exact value matches
  - beginning: fast — prefix matching (e.g. "John" finds "Johnson")
  - middle: slowest — substring matching (e.g. "oh" finds "John")

Recommend 'beginning' for most use cases. Use 'exact' when you know the precise value.`,
    inputSchema: z.object({
      term: z.string().min(1).describe("Search term (min 2 chars, or 1 with match=exact)"),
      entity_type: z.enum(["deal","lead","person","organization","product","project"]).optional().describe("Entity type (omit to search all)"),
      fields: z.string().optional().describe("Comma-separated fields to search within"),
      match: z.enum(["exact","beginning","middle"]).default("beginning").describe("Match type: exact (fastest) | beginning | middle (slowest)"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
      include_fields: z.string().optional().describe("Optional: item.owner, item.type"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown; additional_data?: { next_cursor?: string } }>(
        "/api/v2/itemSearch", compactBody(params as Record<string, unknown>));
      const nc = data.additional_data?.next_cursor;
      return ok(`Search results for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_search_field", {
    title: "Search by Field Value",
    description: `Search items matching a specific field value (v2 itemSearch/field API).

entity_type: deal | lead | person | organization | product | project.
field: field_code (hash key for custom fields) or standard field name (e.g. "email", "phone").
match: exact | beginning | middle.

Useful for finding entities with a known custom field value.`,
    inputSchema: z.object({
      term: z.string().min(1).describe("Value to search for"),
      entity_type: z.enum(["deal","lead","person","organization","product","project"]).describe("Entity type to search"),
      field: z.string().describe("Field code/name to search in"),
      match: z.enum(["exact","beginning","middle"]).default("beginning"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown; additional_data?: { next_cursor?: string } }>(
        "/api/v2/itemSearch/field", compactBody(params as Record<string, unknown>));
      return ok(`Field search results.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });
}
