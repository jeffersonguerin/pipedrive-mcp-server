// src/tools/deals.ts — Pipedrive Deals API v2
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  PipedriveClient,
  ListResponseV2,
  ListResponseV1,
  SingleResponse,
} from "../client.ts";
import {
  ok,
  err,
  compactBody,
  normalizeFilters,
  serialize,
} from "../client.ts";

export function registerDealTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  // ── LIST DEALS ──────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deals",
    {
      title: "List Deals",
      description: `List deals with optional filters and cursor pagination (v2).

Filters: filter_id, ids, person_id, org_id, pipeline_id, stage_id, owner_id, status, updated_since, updated_until.
  - filter_id: use a saved Pipedrive filter (overrides other filters)
  - ids: comma-separated list of up to 100 deal IDs
  - status: open | won | lost | deleted (comma-separated, e.g. "open,won")
  - updated_since / updated_until: RFC3339 format (e.g. 2025-01-01T10:20:00Z)

sort_by (v2 only supports): id | add_time | update_time
include_fields (comma-separated, not returned by default):
  next_activity_id, last_activity_id, first_won_time, products_count, files_count,
  notes_count, followers_count, email_messages_count, activities_count,
  done_activities_count, undone_activities_count, participants_count,
  last_incoming_mail_time, last_outgoing_mail_time, smart_bcc_email, source_lead_id.
custom_fields: comma-separated keys to include (max 15, reduces payload).

Pagination: pass additional_data.next_cursor as cursor. Max limit: 500.`,
      inputSchema: z
        .object({
          filter_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Saved Pipedrive filter ID (overrides other filters)"),
          ids: z
            .string()
            .optional()
            .describe(
              "Comma-separated deal IDs (up to 100); ignored if filter_id is set",
            ),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by linked person ID"),
          org_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by linked organization ID"),
          pipeline_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by pipeline ID"),
          stage_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by stage ID"),
          owner_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe(
              "Filter by owner user ID. Use 0 to return deals for ALL users (omits owner filter).",
            ),
          status: z
            .string()
            .optional()
            .describe("Filter: open | won | lost | deleted (comma-separated)"),
          updated_since: z
            .string()
            .optional()
            .describe(
              "RFC3339: deals updated at or after this time (e.g. 2025-01-01T10:20:00Z)",
            ),
          updated_until: z
            .string()
            .optional()
            .describe("RFC3339: deals updated before this time"),
          cursor: z
            .string()
            .optional()
            .describe(
              "Cursor from previous response additional_data.next_cursor",
            ),
          limit: z
            .number()
            .int()
            .min(1)
            .max(500)
            .default(50)
            .describe("Results per page (default 50, max 500)"),
          sort_by: z
            .enum(["id", "add_time", "update_time"])
            .default("add_time")
            .describe(
              "Sort field (v2 supports: id, add_time, update_time only)",
            ),
          sort_direction: z.enum(["asc", "desc"]).default("desc"),
          include_fields: z
            .string()
            .optional()
            .describe("Comma-separated optional fields (see description)"),
          custom_fields: z
            .string()
            .optional()
            .describe("Comma-separated custom field keys to include (max 15)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/deals",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} deal(s).${nc ? ` Next cursor: ${nc}` : " (end)"}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── GET DEAL ────────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_get_deal",
    {
      title: "Get Deal",
      description: `Get a single deal by ID (v2).

include_fields (not returned by default): next_activity_id, last_activity_id, first_won_time,
products_count, files_count, notes_count, followers_count, email_messages_count,
activities_count, done_activities_count, undone_activities_count, participants_count,
last_incoming_mail_time, last_outgoing_mail_time, smart_bcc_email, source_lead_id.
custom_fields: comma-separated keys to include (max 15 keys, reduces response size).`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Deal ID"),
          include_fields: z
            .string()
            .optional()
            .describe("Comma-separated optional fields"),
          custom_fields: z
            .string()
            .optional()
            .describe("Comma-separated custom field keys (max 15)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, include_fields, custom_fields }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v2/deals/${id}`,
          compactBody({ include_fields, custom_fields }),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── CREATE DEAL ─────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_create_deal",
    {
      title: "Create Deal",
      description: `Create a new deal (v2). Required: title.

v2 field names:
  - owner_id (not user_id)
  - label_ids: array of integers (not comma-separated string)
  - visible_to: integer — 1=Owner only, 3=Entire company, 5=Owner's group, 7=Everyone
  - custom_fields: nested object { field_hash: value }
  - status: open | won | lost
  - expected_close_date: YYYY-MM-DD`,
      inputSchema: z
        .object({
          title: z.string().min(1).describe("Deal title (required)"),
          value: z.number().nonnegative().optional().describe("Monetary value"),
          currency: z
            .string()
            .length(3)
            .optional()
            .describe(
              "3-letter ISO currency code (use pipedrive_list_currencies)",
            ),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Linked person ID"),
          org_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Linked organization ID"),
          pipeline_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Pipeline ID"),
          stage_id: z.number().int().positive().optional().describe("Stage ID"),
          owner_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Owner user ID"),
          status: z
            .enum(["open", "won", "lost"])
            .optional()
            .describe("Deal status"),
          expected_close_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("YYYY-MM-DD"),
          probability: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe("Win probability (0-100)"),
          lost_reason: z.string().optional().describe("Reason for losing"),
          visible_to: z
            .number()
            .int()
            .optional()
            .describe("Visibility: 1, 3, 5, or 7"),
          label_ids: z
            .array(z.number().int())
            .optional()
            .describe("Array of label IDs"),
          custom_fields: z
            .record(z.unknown())
            .optional()
            .describe("Custom fields nested object"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          "/api/v2/deals",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Deal created.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── UPDATE DEAL ─────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_update_deal",
    {
      title: "Update Deal",
      description: `Update a deal via PATCH (v2). Only send fields to change.

To delete: use pipedrive_delete_deal. owner_id replaces v1 user_id. label_ids is an array.

ARCHIVING (since Jul 15, 2025): Set is_archived=true to archive a deal.
Archived deals are NOT returned in pipedrive_list_deals by default.
Use pipedrive_list_archived_deals to list them.
Archived deals CANNOT be edited — only is_archived=false is allowed (unarchive).`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Deal ID to update"),
          title: z.string().min(1).optional(),
          value: z.number().nonnegative().optional(),
          currency: z.string().length(3).optional(),
          person_id: z.number().int().positive().optional(),
          org_id: z.number().int().positive().optional(),
          pipeline_id: z.number().int().positive().optional(),
          stage_id: z.number().int().positive().optional(),
          owner_id: z.number().int().positive().optional(),
          status: z.enum(["open", "won", "lost"]).optional(),
          expected_close_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          probability: z.number().min(0).max(100).optional(),
          lost_reason: z.string().optional(),
          visible_to: z.number().int().optional(),
          label_ids: z.array(z.number().int()).optional(),
          is_archived: z
            .boolean()
            .optional()
            .describe(
              "Archive (true) or unarchive (false). Archived deals CANNOT be edited for other fields (ERR_DEAL_ARCHIVED). Only is_archived=false can unarchive.",
            ),
          custom_fields: z.record(z.unknown()).optional(),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, ...fields }) => {
      try {
        const data = await client.patch<SingleResponse<unknown>>(
          `/api/v2/deals/${id}`,
          compactBody(fields as Record<string, unknown>),
        );
        return ok(`Deal ${id} updated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DELETE DEAL ─────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_delete_deal",
    {
      title: "Delete Deal",
      description: `Soft-delete a deal (v2). Sets is_deleted=true; permanently removed after 30 days.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Deal ID to delete"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        await client.del(`/api/v2/deals/${id}`);
        return ok(
          `Deal ${id} deleted (soft). Permanently removed after 30 days.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── SEARCH DEALS ────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_search_deals",
    {
      title: "Search Deals",
      description: `Search deals by title, notes, or custom fields (v2). Min 2 chars (or 1 with exact_match=true).

Searchable fields: title, notes, custom_fields (comma-separated, default: all).
Custom field types searchable: address, varchar, text, varchar_auto, double, monetary, phone.`,
      inputSchema: z
        .object({
          term: z
            .string()
            .min(1)
            .describe("Search term (min 2 chars unless exact_match=true)"),
          fields: z
            .string()
            .optional()
            .describe("Comma-separated fields: title, notes, custom_fields"),
          exact_match: z
            .boolean()
            .optional()
            .describe("Only exact matches (not case-sensitive)"),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Restrict to this person"),
          org_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Restrict to this org"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/deals/search",
          compactBody(params as Record<string, unknown>),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} deal(s) for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── LIST DEAL PRODUCTS ──────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_products",
    {
      title: "List Deal Products",
      description: `List products attached to a single deal (v2).

Returns line items: id, deal_id, product_id, name, item_price, quantity, sum,
tax, tax_method, currency, is_enabled, discount, discount_type, comments, add_time, update_time.
sort_by: id | add_time | update_time | order_nr`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z
            .enum(["id", "add_time", "update_time", "order_nr"])
            .default("id"),
          sort_direction: z.enum(["asc", "desc"]).default("asc"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, cursor, limit, sort_by, sort_direction }) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          `/api/v2/deals/${deal_id}/products`,
          compactBody({ cursor, limit, sort_by, sort_direction }),
        );
        return ok(
          `${data.data.length} product(s) on deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── GET PRODUCTS FOR MULTIPLE DEALS ────────────────────────────────────────
  server.registerTool(
    "pipedrive_get_deals_products",
    {
      title: "Get Products for Multiple Deals",
      description: `Get products attached to multiple deals in one request (v2 bulk endpoint).

Provide up to 100 deal IDs as a comma-separated string or array.
More efficient than calling pipedrive_list_deal_products for each deal individually.
sort_by: id | deal_id | add_time | update_time | order_nr`,
      inputSchema: z
        .object({
          deal_ids: z
            .string()
            .describe("Comma-separated deal IDs (up to 100, e.g. '1,2,3')"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z
            .enum(["id", "deal_id", "add_time", "update_time", "order_nr"])
            .default("id"),
          sort_direction: z.enum(["asc", "desc"]).default("asc"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_ids, cursor, limit, sort_by, sort_direction }) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/deals/products",
          compactBody({ deal_ids, cursor, limit, sort_by, sort_direction }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} product line item(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── ADD PRODUCT TO DEAL ─────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_add_product_to_deal",
    {
      title: "Add Product to Deal",
      description: `Attach a product to a deal with pricing (v2). Required: deal_id, product_id, item_price, quantity.

tax_method: inclusive (tax included in price) | exclusive (tax added on top) | none.
discount_type: percentage | amount.
is_enabled: if false, this line item is excluded from deal value calculation.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          product_id: z
            .number()
            .int()
            .positive()
            .describe("Product ID to attach"),
          item_price: z
            .number()
            .nonnegative()
            .describe("Unit price for this deal"),
          quantity: z.number().positive().describe("Quantity"),
          discount: z
            .number()
            .nonnegative()
            .optional()
            .describe("Discount value"),
          discount_type: z.enum(["percentage", "amount"]).optional(),
          duration: z
            .number()
            .positive()
            .optional()
            .describe("Duration (for subscriptions)"),
          duration_unit: z.string().optional().describe("day | month | year"),
          product_variation_id: z.number().int().positive().optional(),
          comments: z.string().optional().describe("Line item comment"),
          tax: z.number().min(0).max(100).optional().describe("Tax percentage"),
          tax_method: z.enum(["inclusive", "exclusive", "none"]).optional(),
          is_enabled: z
            .boolean()
            .optional()
            .describe("Include in deal value calculation"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deal_id, ...body }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/products`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Product added to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── UPDATE DEAL PRODUCT ──────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_update_deal_product",
    {
      title: "Update Deal Product",
      description: `Update a product line item attached to a deal via PATCH (v2).

Only include fields to change. product_variation_id can be changed.
NOTE: This updates the deal-product attachment (price, qty, etc.), NOT the product catalog entry itself.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          product_attachment_id: z
            .number()
            .int()
            .positive()
            .describe("Deal-product line item ID (from list_deal_products)"),
          item_price: z
            .number()
            .nonnegative()
            .optional()
            .describe("Updated unit price"),
          quantity: z
            .number()
            .positive()
            .optional()
            .describe("Updated quantity"),
          discount: z
            .number()
            .nonnegative()
            .optional()
            .describe("Discount value"),
          discount_type: z.enum(["percentage", "amount"]).optional(),
          duration: z.number().positive().optional(),
          duration_unit: z.string().optional().describe("day | month | year"),
          product_variation_id: z.number().int().positive().optional(),
          comments: z.string().optional().describe("Line item comment"),
          tax: z.number().min(0).max(100).optional().describe("Tax percentage"),
          tax_method: z.enum(["inclusive", "exclusive", "none"]).optional(),
          is_enabled: z
            .boolean()
            .optional()
            .describe("Include in deal value calculation"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, product_attachment_id, ...body }) => {
      try {
        const data = await client.patch<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/products/${product_attachment_id}`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Deal product ${product_attachment_id} updated.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DELETE DEAL PRODUCT ─────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_delete_deal_product",
    {
      title: "Delete Deal Product",
      description: `Remove a product line item from a deal (v2).

product_attachment_id is the deal-product line item ID (from list_deal_products), NOT the product catalog ID.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          product_attachment_id: z
            .number()
            .int()
            .positive()
            .describe("Deal-product line item ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, product_attachment_id }) => {
      try {
        await client.del(
          `/api/v2/deals/${deal_id}/products/${product_attachment_id}`,
        );
        return ok(
          `Product line item ${product_attachment_id} removed from deal ${deal_id}.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL PARTICIPANTS ────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_participants",
    {
      title: "List Deal Participants",
      description: `List persons who are participants in a deal (v1 API).

Participants are persons linked to a deal but not as the primary person_id.
Returns person objects with their contact info.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          start: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Pagination offset (v1)"),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, start, limit }) => {
      try {
        const data = await client.get<ListResponseV1<unknown>>(
          `/api/v1/deals/${deal_id}/participants`,
          compactBody({ start, limit }),
        );
        const pg = data.additional_data?.pagination;
        return ok(
          `${data.data?.length ?? 0} participant(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_add_deal_participant",
    {
      title: "Add Deal Participant",
      description: `Add a person as a participant to a deal (v1 API).

Participants are additional persons linked to a deal (beyond the primary person_id).
Useful for tracking multiple contacts involved in a deal.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          person_id: z
            .number()
            .int()
            .positive()
            .describe("Person ID to add as participant"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deal_id, person_id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v1/deals/${deal_id}/participants`,
          { person_id },
        );
        return ok(
          `Person ${person_id} added as participant to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_deal_participant",
    {
      title: "Delete Deal Participant",
      description: `Remove a person from a deal's participants (v1 API).

participant_id is the ID of the participant relationship, NOT the person_id.
Use pipedrive_list_deal_participants to find the participant IDs.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          participant_id: z
            .number()
            .int()
            .positive()
            .describe(
              "Participant relationship ID (from list_deal_participants)",
            ),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, participant_id }) => {
      try {
        await client.del(
          `/api/v1/deals/${deal_id}/participants/${participant_id}`,
        );
        return ok(
          `Participant ${participant_id} removed from deal ${deal_id}.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL FOLLOWERS ──────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_followers",
    {
      title: "List Deal Followers",
      description: `List users following a deal (v2 API).

Followers receive notifications about deal updates.
Returns: user_id, add_time (RFC3339).`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, cursor, limit }) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          `/api/v2/deals/${deal_id}/followers`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} follower(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_add_deal_follower",
    {
      title: "Add Deal Follower",
      description: `Add a user as a follower of a deal (v2 API).

Followers receive notifications about updates to this deal.
Returns 400 if the user is already following.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          user_id: z
            .number()
            .int()
            .positive()
            .describe("User ID to add as follower"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deal_id, user_id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/followers`,
          { user_id },
        );
        return ok(
          `User ${user_id} added as follower to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_deal_follower",
    {
      title: "Delete Deal Follower",
      description: `Remove a user from deal followers (v2 API).

IMPORTANT: The follower_id here is the USER ID (not a separate follower object ID).
Use pipedrive_list_deal_followers to get user_ids.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          user_id: z
            .number()
            .int()
            .positive()
            .describe("User ID to remove as follower"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, user_id }) => {
      try {
        await client.del(`/api/v2/deals/${deal_id}/followers/${user_id}`);
        return ok(`User ${user_id} removed as follower from deal ${deal_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── CONVERT DEAL TO LEAD ────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_convert_deal_to_lead",
    {
      title: "Convert Deal to Lead",
      description: `Convert a deal into a lead (v2 API). Returns a conversion job ID.

Check status with pipedrive_get_deal_conversion_status.
On success: related entities (notes, files, activities) are transferred to the new lead.
The deal is marked as deleted after successful conversion.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID to convert"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deal_id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/convert`,
          {},
        );
        return ok(
          `Deal-to-lead conversion initiated.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_deal_conversion_status",
    {
      title: "Get Deal Conversion Status",
      description: `Check the status of a deal-to-lead conversion (v2 API).

Status values: not_started | running | completed | failed | rejected.
When completed, response includes the created lead ID (UUID).`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          conversion_id: z
            .string()
            .uuid()
            .describe(
              "Conversion job ID (UUID from pipedrive_convert_deal_to_lead)",
            ),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, conversion_id }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/convert/status/${conversion_id}`,
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── LIST ARCHIVED DEALS ─────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_archived_deals",
    {
      title: "List Archived Deals",
      description: `List archived deals (v2 API — separate endpoint, effective Jul 15, 2025).

Archived deals are NOT returned by pipedrive_list_deals.
They can only be unarchived via pipedrive_update_deal with is_archived=false.
Supports same filters as list_deals: filter_id, ids, person_id, org_id,
pipeline_id, stage_id, owner_id, status, updated_since, updated_until.
Also supports same include_fields and custom_fields params.`,
      inputSchema: z
        .object({
          filter_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Saved filter ID"),
          ids: z
            .string()
            .optional()
            .describe("Comma-separated deal IDs (up to 100)"),
          person_id: z.number().int().positive().optional(),
          org_id: z.number().int().positive().optional(),
          pipeline_id: z.number().int().positive().optional(),
          stage_id: z.number().int().positive().optional(),
          owner_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe(
              "Filter by owner user ID. Use 0 to return deals for ALL users (omits owner filter).",
            ),
          status: z.string().optional().describe("open | won | lost | deleted"),
          updated_since: z
            .string()
            .optional()
            .describe("RFC3339 (e.g. 2025-01-01T10:20:00Z)"),
          updated_until: z.string().optional().describe("RFC3339"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z
            .enum(["id", "add_time", "update_time"])
            .default("add_time"),
          sort_direction: z.enum(["asc", "desc"]).default("desc"),
          include_fields: z.string().optional(),
          custom_fields: z
            .string()
            .optional()
            .describe("Comma-separated custom field keys (max 15)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/deals/archived",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} archived deal(s).${nc ? ` Next cursor: ${nc}` : " (end)"}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── MERGE DEALS ─────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_merge_deals",
    {
      title: "Merge Two Deals",
      description: `Merge two deals into one (v1 API with PUT).

merge_with_id is the deal whose data is KEPT (prioritized) in case of conflicts.
The deal identified by 'id' (the first param) will be merged into merge_with_id and deleted.
All participants, followers, activities, notes, files are transferred to merge_with_id.`,
      inputSchema: z
        .object({
          id: z
            .number()
            .int()
            .positive()
            .describe("Deal ID that will be merged and deleted"),
          merge_with_id: z
            .number()
            .int()
            .positive()
            .describe("Deal ID to keep (data from this deal is prioritized)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, merge_with_id }) => {
      try {
        const data = await client.put<SingleResponse<unknown>>(
          `/api/v1/deals/${id}/merge`,
          { merge_with_id },
        );
        return ok(
          `Deal ${id} merged into deal ${merge_with_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DUPLICATE DEAL ──────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_duplicate_deal",
    {
      title: "Duplicate Deal",
      description: `Create a duplicate of an existing deal (v2 API).

Copies deal data, custom fields. Does NOT copy activities, notes, files, participants, or followers.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Deal ID to duplicate"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/deals/${id}/duplicate`,
          {},
        );
        return ok(`Deal ${id} duplicated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );
}
