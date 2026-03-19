// src/tools/filters.ts — Pipedrive Filters API v1 (no v2 equivalent yet)
// Filters are saved views used across list/get endpoints (filter_id parameter).
// Agents NEED this to discover, create, and manage filters referenced in many tools.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerFilterTools(server: McpServer, client: PipedriveClient): void {

  server.registerTool("pipedrive_list_filters", {
    title: "List Filters",
    description: `List all saved filters (v1 API).

Filters are saved query conditions used across list endpoints (the filter_id parameter).
Use type to filter by entity type: deals | leads | persons | org | products | activity.

Returns: id, name, type, active_flag, conditions, custom_flag, user_id, add_time, update_time.
The 'id' value is what you pass as filter_id in list tools like pipedrive_list_deals.`,
    inputSchema: z.object({
      type: z.enum(["deals","leads","persons","org","products","activity"]).optional()
        .describe("Filter entity type. Omit to list all types."),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ type }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/filters", compactBody({ type }));
      return ok(`${data.data?.length ?? 0} filter(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_filter", {
    title: "Get Filter",
    description: `Get details of a specific filter (v1 API). Shows name, type, and the full conditions JSON.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Filter ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/filters/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_filter", {
    title: "Create Filter",
    description: `Create a new filter (v1 API). Required: name, type, conditions.

type: deals | leads | persons | org | products | activity.

conditions is a JSON object with this structure:
{
  "glue": "and",
  "conditions": [
    {
      "glue": "and",
      "conditions": [
        { "object": "deal", "field_id": "stage_id", "operator": "=", "value": 2 }
      ]
    }
  ]
}

Operators: =, !=, <, >, <=, >=, LIKE, NOT LIKE, IS NULL, IS NOT NULL, IN, NOT IN.
field_id: can be standard field name (e.g. "stage_id", "status") or custom field hash key.`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Filter name (required)"),
      type: z.enum(["deals","leads","persons","org","products","activity"]).describe("Entity type (required)"),
      conditions: z.record(z.unknown()).describe("Filter conditions JSON object (required)"),
      visible_to: z.number().int().optional().describe("Visibility: 1=Owner only, 3=Entire company"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v1/filters", compactBody(params as Record<string, unknown>));
      return ok(`Filter created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_filter", {
    title: "Update Filter",
    description: `Update a filter (v1 API — uses PUT). Only include fields to change.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Filter ID to update"),
      name: z.string().min(1).optional(),
      conditions: z.record(z.unknown()).optional().describe("Updated conditions JSON"),
      visible_to: z.number().int().optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.put<SingleResponse<unknown>>(`/api/v1/filters/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Filter ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_filter", {
    title: "Delete Filter",
    description: `Delete a filter (v1 API). Permanent deletion.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Filter ID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/filters/${id}`);
      return ok(`Filter ${id} deleted.`);
    } catch (e) { return err(e); }
  });

  // ── FILTER HELPERS ──────────────────────────────────────────────────────────
  server.registerTool("pipedrive_get_filter_helpers", {
    title: "Get Filter Helpers",
    description: `Get all filter helper conditions and field types (v1 API). No parameters.

Returns reference data needed to construct filter conditions: available operators,
field types, condition types. Use this before creating filters to know which
conditions and operators are valid.

Returns:
  Object with available conditions, glue types, custom_field_types, etc.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<SingleResponse<unknown>>("/api/v1/filters/helpers");
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });
}
