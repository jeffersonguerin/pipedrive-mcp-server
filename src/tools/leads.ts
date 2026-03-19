// src/tools/leads.ts — Pipedrive Leads API
// List/Get/Create/Update/Delete: v1 API (no v2 equivalent yet)
// Search: v2 API (/api/v2/leads/search)
// Convert to deal: v2 API (/api/v2/leads/:id/convert)
//
// BREAKING CHANGES (effective Jul 15, 2025):
//   - GET /v1/leads no longer accepts archived_status param (ignored)
//   - Only non-archived leads returned by default
//   - Use GET /v1/leads/archived for archived leads
//   - Archived leads are NOT editable (only is_archived=false to unarchive)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV1, ListResponseV2, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerLeadTools(server: McpServer, client: PipedriveClient): void {

  server.registerTool("pipedrive_list_leads", {
    title: "List Leads",
    description: `List active (non-archived) leads (v1 API). Returns only non-archived leads.

NOTE: Since Jul 15, 2025, this endpoint ONLY returns non-archived leads.
Use pipedrive_list_archived_leads to fetch archived leads.

Pagination: v1 offset-based (start + limit, not cursor).
sort: field_name ASC or field_name ASC, field_name2 DESC.`,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).default(50),
      start: z.number().int().min(0).default(0).describe("Pagination offset (v1)"),
      owner_id: z.number().int().positive().optional(),
      person_id: z.number().int().positive().optional(),
      org_id: z.number().int().positive().optional(),
      sort: z.string().optional().describe("e.g. 'next_activity_time ASC'"),
      filter_id: z.number().int().positive().optional(),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>("/api/v1/leads", compactBody(params as Record<string, unknown>));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} lead(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_list_archived_leads", {
    title: "List Archived Leads",
    description: `List archived leads (v1 API — separate endpoint since Jul 15, 2025).

Archived leads are those that have been set to is_archived=true.
They cannot be edited except to unarchive them (is_archived=false).
Use pipedrive_list_leads for active (non-archived) leads.`,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).default(50),
      start: z.number().int().min(0).default(0).describe("Pagination offset (v1)"),
      owner_id: z.number().int().positive().optional(),
      person_id: z.number().int().positive().optional(),
      org_id: z.number().int().positive().optional(),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>("/api/v1/leads/archived", compactBody(params as Record<string, unknown>));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} archived lead(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_lead", {
    title: "Get Lead",
    description: `Get a lead by ID (v1 API). Leads use UUID identifiers (not integers).

Custom fields on leads use the same hash keys as deals.`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead ID (UUID format, e.g. '4b8e87bf-...')"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/leads/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_lead", {
    title: "Create Lead",
    description: `Create a lead (v1 API). Required: title.

A lead should be linked to person_id and/or org_id.
value: { amount: 1000, currency: "USD" }
label_ids: array of label UUIDs (different from deal label_ids which are integers).
expected_close_date: YYYY-MM-DD.`,
    inputSchema: z.object({
      title: z.string().min(1).describe("Lead title (required)"),
      owner_id: z.number().int().positive().optional(),
      person_id: z.number().int().positive().optional().describe("Linked person (recommended)"),
      org_id: z.number().int().positive().optional().describe("Linked org (recommended)"),
      value: z.object({
        amount: z.number().nonnegative().describe("Monetary amount"),
        currency: z.string().length(3).describe("3-letter currency code"),
      }).optional().describe("Lead value e.g. { amount: 1000, currency: 'USD' }"),
      expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
      label_ids: z.array(z.string().uuid()).optional().describe("Array of label UUIDs (UUIDs, not integers)"),
      was_seen: z.boolean().optional(),
      channel: z.number().int().optional(),
      channel_id: z.string().optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v1/leads", compactBody(params as Record<string, unknown>));
      return ok(`Lead created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_lead", {
    title: "Update Lead",
    description: `Update a lead via PATCH (v1 API). Only include fields to change.

IMPORTANT (since Jul 15, 2025): Archived leads CANNOT be edited.
Attempting to edit an archived lead returns ERR_LEAD_ARCHIVED.
To unarchive: set is_archived=false (only change allowed on archived leads).`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead ID (UUID)"),
      title: z.string().min(1).optional(),
      owner_id: z.number().int().positive().optional(),
      person_id: z.number().int().positive().optional(),
      org_id: z.number().int().positive().optional(),
      value: z.object({
        amount: z.number().nonnegative(),
        currency: z.string().length(3),
      }).optional(),
      expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      label_ids: z.array(z.string().uuid()).optional(),
      is_archived: z.boolean().optional().describe("Archive (true) or unarchive (false) this lead. Archived leads cannot be edited for other fields."),
      was_seen: z.boolean().optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v1/leads/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Lead ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_lead", {
    title: "Delete Lead",
    description: `Permanently delete a lead (v1 API). Deletion is IMMEDIATE and irreversible.

Note: Unlike deals, lead deletion is not soft-delete — it's permanent.`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead ID (UUID)"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/leads/${id}`);
      return ok(`Lead ${id} permanently deleted.`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_search_leads", {
    title: "Search Leads",
    description: `Search leads by title or custom fields (v2 search API). Min 2 chars.

Searchable fields: title, notes, custom_fields.`,
    inputSchema: z.object({
      term: z.string().min(1).describe("Search term (min 2 chars unless exact_match=true)"),
      fields: z.string().optional().describe("Fields: title, notes, custom_fields"),
      exact_match: z.boolean().optional(),
      person_id: z.number().int().positive().optional(),
      org_id: z.number().int().positive().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>("/api/v2/leads/search", compactBody(params as Record<string, unknown>));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} lead(s) for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_convert_lead_to_deal", {
    title: "Convert Lead to Deal",
    description: `Convert a lead to a deal (v2 API). Returns a conversion job ID.

Check status with pipedrive_get_lead_conversion_status.
On success: notes/files/emails/activities transfer to the new deal. Lead is marked deleted.
stage_id takes priority over pipeline_id (pipeline_id ignored if stage_id provided).`,
    inputSchema: z.object({
      lead_id: z.string().uuid().describe("Lead ID (UUID) to convert"),
      stage_id: z.number().int().positive().optional().describe("Stage for the new deal"),
      pipeline_id: z.number().int().positive().optional().describe("Pipeline (ignored if stage_id provided)"),
      owner_id: z.number().int().positive().optional().describe("Owner for the new deal"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ lead_id, ...body }) => {
    try {
      const data = await client.post<SingleResponse<unknown>>(`/api/v2/leads/${lead_id}/convert`, compactBody(body as Record<string, unknown>));
      return ok(`Conversion initiated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_lead_conversion_status", {
    title: "Get Lead Conversion Status",
    description: `Check status of a lead-to-deal conversion (v2 API).

Status: not_started | running | completed | failed | rejected.
When completed, response includes the new deal ID.`,
    inputSchema: z.object({
      lead_id: z.string().uuid().describe("Lead ID (UUID)"),
      conversion_id: z.string().describe("Conversion job ID from pipedrive_convert_lead_to_deal"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ lead_id, conversion_id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v2/leads/${lead_id}/convert/status/${conversion_id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });
}
