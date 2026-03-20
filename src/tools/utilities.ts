// src/tools/utilities.ts — Pipedrive utility/reference endpoints (v1)
// These are essential discovery tools agents need before creating activities or deals
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerUtilityTools(server: McpServer, client: PipedriveClient): void {

  // C1-A7: Activity types — agents NEED this to know valid type values
  server.registerTool("pipedrive_list_activity_types", {
    title: "List Activity Types",
    description: `List all available activity types (v1 API).

IMPORTANT: Use this before creating activities to find valid type values.
The 'key_string' field is what you pass as the 'type' parameter when creating/updating activities.
key_string is auto-generated from the name and cannot be changed.

Returns: id, name, key_string, icon_key, color, order_nr, is_custom_flag, active_flag.
Common built-in key_strings: call, meeting, task, deadline, email, lunch.
Custom types will have user-defined key_strings.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/activityTypes");
      return ok(`${data.data?.length ?? 0} activity type(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // C1-A8: Currencies — agents need valid ISO codes for deals/products
  server.registerTool("pipedrive_list_currencies", {
    title: "List Currencies",
    description: `List all supported currencies (v1 API).

Use this to find valid 3-letter currency codes before creating deals or products.
Returns: code, name, symbol, decimal_points, is_custom_flag.
Example codes: USD, EUR, GBP, BRL, JPY.

The 'code' field is what you pass as the 'currency' parameter in deals and products.`,
    inputSchema: z.object({
      term: z.string().optional().describe("Optional: filter currencies by name or code"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ term }) => {
    try {
      const params = term ? { term } : {};
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/currencies", params);
      return ok(`${data.data?.length ?? 0} currency/ies.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Bonus: Deal fields — useful for understanding custom field keys and priority mappings
  server.registerTool("pipedrive_list_deal_fields", {
    title: "List Deal Fields",
    description: `List all deal fields including custom fields (v2 API).

Use this to discover custom field hash keys for use in create/update operations.
Also shows field types, options (for dropdown fields), and subfields.

v2 changes: field_code (was key), field_name (was name), is_custom_field (was edit_flag).
Custom field hash keys look like: '53c2f18db6a1655d6af8bba77d9679565f975fd8'.

Optional include_fields: ui_visibility, important_fields, required_fields.`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      include_fields: z.string().optional().describe("Optional: ui_visibility, important_fields, required_fields"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit, include_fields }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        "/api/v2/dealFields", compactBody({ cursor, limit, include_fields }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} deal field(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Activity fields — for priority mapping
  server.registerTool("pipedrive_list_activity_fields", {
    title: "List Activity Fields",
    description: `List all activity fields (v2 API).

Use this to understand the 'priority' field options and any custom activity fields.
Priority is an integer that maps to a label — this endpoint shows valid values.

v2: field_code (was key), field_name (was name), is_custom_field (was edit_flag).`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        "/api/v2/activityFields", compactBody({ cursor, limit }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} activity field(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Person fields — discover custom fields for persons
  server.registerTool("pipedrive_list_person_fields", {
    title: "List Person Fields",
    description: `List all person fields including custom fields (v2 API, released Dec 2025).

Use this to discover custom field hash keys for use in create/update person operations.
Also shows field types, options (for dropdown fields), and subfields.

v2: field_code (was key), field_name (was name), is_custom_field (was edit_flag).
Custom field hash keys look like: '53c2f18db6a1655d6af8bba77d9679565f975fd8'.

Optional include_fields: ui_visibility, important_fields, required_fields.`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      include_fields: z.string().optional().describe("Optional: ui_visibility, important_fields, required_fields"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit, include_fields }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        "/api/v2/personFields", compactBody({ cursor, limit, include_fields }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} person field(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Organization fields — discover custom fields for organizations
  server.registerTool("pipedrive_list_organization_fields", {
    title: "List Organization Fields",
    description: `List all organization fields including custom fields (v2 API, released Dec 2025).

Use this to discover custom field hash keys for use in create/update org operations.

v2: field_code (was key), field_name (was name), is_custom_field (was edit_flag).

Optional include_fields: ui_visibility, important_fields, required_fields.`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      include_fields: z.string().optional().describe("Optional: ui_visibility, important_fields, required_fields"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit, include_fields }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        "/api/v2/organizationFields", compactBody({ cursor, limit, include_fields }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} organization field(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Product fields — discover custom fields for products
  server.registerTool("pipedrive_list_product_fields", {
    title: "List Product Fields",
    description: `List all product fields including custom fields (v2 API, released Dec 2025).

Use this to discover custom field hash keys for use in create/update product operations.

v2: field_code (was key), field_name (was name), is_custom_field (was edit_flag).

Optional include_fields: ui_visibility, important_fields, required_fields.`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      include_fields: z.string().optional().describe("Optional: ui_visibility, important_fields, required_fields"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit, include_fields }) => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        "/api/v2/productFields", compactBody({ cursor, limit, include_fields }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} product field(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Lead labels — needed to map lead label UUIDs to names
  server.registerTool("pipedrive_list_lead_labels", {
    title: "List Lead Labels",
    description: `List all lead labels (v1 API).

Lead labels use UUID identifiers (unlike deal labels which use integer IDs).
Returns: id (UUID), name, color.
Use these UUIDs in the label_ids array when creating/updating leads.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/leadLabels");
      return ok(`${data.data?.length ?? 0} lead label(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // Lead sources — discover where leads come from
  server.registerTool("pipedrive_list_lead_sources", {
    title: "List Lead Sources",
    description: `List all lead sources (v1 API).

Returns: name (string). Examples: API, Manually created, Leadbooster, Web Forms, etc.
Lead sources are read-only and cannot be created or deleted via API.`,
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async () => {
    try {
      const data = await client.get<{ success: boolean; data: unknown[] }>("/api/v1/leadSources");
      return ok(`${data.data?.length ?? 0} lead source(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });
}
