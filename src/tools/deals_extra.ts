// src/tools/deals_extra.ts — Pipedrive Deals sub-resources (v1.2.0)
// Summary, timeline, discounts, installments, changelog, files, flow, permitted users
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

export function registerDealExtraTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  // ── DEALS SUMMARY ───────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_get_deals_summary",
    {
      title: "Get Deals Summary",
      description: `Get aggregate summary of deals — total value, count, and weighted value by status and currency (v2 API).

Returns values_total (grouped by currency with open/won/lost counts and sums).
Filter with same params as list_deals: user_id, pipeline_id, filter_id, stage_id, status.`,
      inputSchema: z
        .object({
          user_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner user ID. Use 0 for all users."),
          pipeline_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by pipeline ID"),
          filter_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by saved filter ID"),
          stage_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by stage ID"),
          status: z
            .string()
            .optional()
            .describe("open | won | lost (comma-separated)"),
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
        const data = await client.get<SingleResponse<unknown>>(
          "/api/v2/deals/summary",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_archived_deals_summary",
    {
      title: "Get Archived Deals Summary",
      description: `Get aggregate summary of archived deals (v2 API). Same structure as deals summary.`,
      inputSchema: z
        .object({
          user_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner user ID. Use 0 for all users."),
          pipeline_id: z.number().int().positive().optional(),
          filter_id: z.number().int().positive().optional(),
          stage_id: z.number().int().positive().optional(),
          status: z.string().optional(),
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
        const data = await client.get<SingleResponse<unknown>>(
          "/api/v2/deals/archived/summary",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEALS TIMELINE ──────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_get_deals_timeline",
    {
      title: "Get Deals Timeline",
      description: `Get deals plotted on a timeline by a date field (v2 API).

Returns deals grouped by time intervals based on a date field.
Required: start_date, interval (day | week | month | quarter), amount (number of intervals), field_key.

field_key: the date field to plot by (e.g. 'add_time', 'won_time', 'expected_close_date', or a custom date field hash).

Example: start_date=2025-01-01, interval=month, amount=12, field_key=won_time
→ returns deals grouped by month for the year 2025, plotted by their won_time.`,
      inputSchema: z
        .object({
          start_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Start date YYYY-MM-DD (required)"),
          interval: z
            .enum(["day", "week", "month", "quarter"])
            .describe("Time interval (required)"),
          amount: z
            .number()
            .int()
            .min(1)
            .max(365)
            .describe("Number of intervals from start_date (required)"),
          field_key: z
            .string()
            .min(1)
            .describe(
              "Date field key to group by (required). e.g. 'add_time', 'won_time', 'expected_close_date'",
            ),
          user_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner. Use 0 for all users."),
          pipeline_id: z.number().int().positive().optional(),
          filter_id: z.number().int().positive().optional(),
          exclude_deals: z
            .number()
            .int()
            .min(0)
            .max(1)
            .optional()
            .describe("1=only counts (no deal objects), 0=include deal data"),
          totals_convert_currency: z
            .string()
            .length(3)
            .optional()
            .describe("3-letter currency code to convert totals to"),
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
        const data = await client.get<SingleResponse<unknown>>(
          "/api/v2/deals/timeline",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_archived_deals_timeline",
    {
      title: "Get Archived Deals Timeline",
      description: `Get archived deals plotted on a timeline (v2 API). Same params as deals timeline.`,
      inputSchema: z
        .object({
          start_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Start date YYYY-MM-DD (required)"),
          interval: z
            .enum(["day", "week", "month", "quarter"])
            .describe("Time interval (required)"),
          amount: z
            .number()
            .int()
            .min(1)
            .max(365)
            .describe("Number of intervals (required)"),
          field_key: z.string().min(1).describe("Date field key (required)"),
          user_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner. Use 0 for all users."),
          pipeline_id: z.number().int().positive().optional(),
          filter_id: z.number().int().positive().optional(),
          exclude_deals: z.number().int().min(0).max(1).optional(),
          totals_convert_currency: z.string().length(3).optional(),
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
        const data = await client.get<SingleResponse<unknown>>(
          "/api/v2/deals/archived/timeline",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL DISCOUNTS ──────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_discounts",
    {
      title: "List Deal Discounts",
      description: `List discounts attached to a deal (v2 API).

Deal-level discounts are separate from product-level discounts.
Returns: id, type (percentage | amount), value, description.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id }) => {
      try {
        const data = await client.get<{ success: boolean; data: unknown[] }>(
          `/api/v2/deals/${deal_id}/discounts`,
        );
        return ok(
          `${data.data?.length ?? 0} discount(s).\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_add_deal_discount",
    {
      title: "Add Deal Discount",
      description: `Add a deal-level discount (v2 API).

type: percentage | amount.
value: the discount value (% if percentage, absolute if amount).`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          type: z
            .enum(["percentage", "amount"])
            .describe("Discount type (required)"),
          value: z.number().nonnegative().describe("Discount value (required)"),
          description: z.string().optional().describe("Optional description"),
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
          `/api/v2/deals/${deal_id}/discounts`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Discount added to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_deal_discount",
    {
      title: "Update Deal Discount",
      description: `Update a deal-level discount via PATCH (v2 API).`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          discount_id: z.number().int().positive().describe("Discount ID"),
          type: z.enum(["percentage", "amount"]).optional(),
          value: z.number().nonnegative().optional(),
          description: z.string().optional(),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, discount_id, ...body }) => {
      try {
        const data = await client.patch<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/discounts/${discount_id}`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Discount ${discount_id} updated.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_deal_discount",
    {
      title: "Delete Deal Discount",
      description: `Remove a discount from a deal (v2 API). Changes deal value if one-time products are attached.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          discount_id: z.number().int().positive().describe("Discount ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, discount_id }) => {
      try {
        await client.del(`/api/v2/deals/${deal_id}/discounts/${discount_id}`);
        return ok(`Discount ${discount_id} removed from deal ${deal_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL INSTALLMENTS (Growth+ plans) ───────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_installments",
    {
      title: "List Deal Installments",
      description: `List installments for a deal or multiple deals (v2 API). Growth+ plans only.

Installments can only exist on deals with one-time products. Deals with recurring products cannot have installments.
Provide deal_ids (comma-separated, up to 100) for bulk fetching.`,
      inputSchema: z
        .object({
          deal_ids: z.string().describe("Comma-separated deal IDs (up to 100)"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z.enum(["id", "billing_date", "deal_id"]).default("id"),
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
    async (params) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/deals/installments",
          compactBody(params as Record<string, unknown>),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} installment(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_add_deal_installment",
    {
      title: "Add Deal Installment",
      description: `Add an installment to a deal (v2 API). Growth+ plans only.

Installments can only be added if the deal has at least one one-time product.
If the deal has any recurring products, installments are NOT allowed.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          name: z.string().min(1).describe("Installment name (required)"),
          amount: z
            .number()
            .positive()
            .describe("Installment amount — must be > 0 (required)"),
          billing_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Billing date YYYY-MM-DD (required)"),
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
          `/api/v2/deals/${deal_id}/installments`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Installment added to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_deal_installment",
    {
      title: "Update Deal Installment",
      description: `Update an installment on a deal via PATCH (v2 API). Growth+ plans only.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          installment_id: z
            .number()
            .int()
            .positive()
            .describe("Installment ID"),
          name: z.string().min(1).optional(),
          amount: z.number().positive().optional().describe("Must be > 0"),
          billing_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, installment_id, ...body }) => {
      try {
        const data = await client.patch<SingleResponse<unknown>>(
          `/api/v2/deals/${deal_id}/installments/${installment_id}`,
          compactBody(body as Record<string, unknown>),
        );
        return ok(
          `Installment ${installment_id} updated.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_deal_installment",
    {
      title: "Delete Deal Installment",
      description: `Remove an installment from a deal (v2 API). Growth+ plans only.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          installment_id: z
            .number()
            .int()
            .positive()
            .describe("Installment ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, installment_id }) => {
      try {
        await client.del(
          `/api/v2/deals/${deal_id}/installments/${installment_id}`,
        );
        return ok(
          `Installment ${installment_id} removed from deal ${deal_id}.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL CHANGELOG ──────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_changelog",
    {
      title: "List Deal Changelog",
      description: `List field value changes (audit trail) for a deal (v1 API, cursor-paginated).

Returns chronological list of field changes: field_key, old_value, new_value, time, user_id.
Useful for auditing who changed what and when.`,
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
        const data = await client.get<{
          success: boolean;
          data: unknown[];
          additional_data?: { next_cursor?: string };
        }>(
          `/api/v1/deals/${deal_id}/changelog`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data?.length ?? 0} change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL FILES ──────────────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_files",
    {
      title: "List Deal Files",
      description: `List files attached to a specific deal (v1 API).

Returns file objects with: id, name, file_type, file_size, url (signed download link), add_time.
Alternative: use pipedrive_list_files with deal_id param.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          start: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Pagination offset"),
          limit: z.number().int().min(1).max(100).default(50),
          sort: z.string().optional().describe("e.g. 'update_time DESC'"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, start, limit, sort }) => {
      try {
        const data = await client.get<ListResponseV1<unknown>>(
          `/api/v1/deals/${deal_id}/files`,
          compactBody({ start, limit, sort }),
        );
        const pg = data.additional_data?.pagination;
        return ok(
          `${data.data?.length ?? 0} file(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL FLOW / UPDATES ─────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_updates",
    {
      title: "List Deal Updates",
      description: `List activity feed / updates about a deal (v1 API).

Returns a stream of events: notes added, activities completed, emails sent, field changes, etc.
items: comma-separated filter (activity, plannedActivity, note, file, change, deal, follower, participant, mailMessage, mailMessageWithAttachment, invoice, activityFile, document).`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          all_changes: z
            .number()
            .int()
            .min(0)
            .max(1)
            .optional()
            .describe("1=include custom field changes"),
          items: z
            .string()
            .optional()
            .describe("Comma-separated event types to include"),
          start: z.number().int().min(0).default(0),
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
    async ({ deal_id, ...params }) => {
      try {
        const data = await client.get<ListResponseV1<unknown>>(
          `/api/v1/deals/${deal_id}/flow`,
          compactBody(params as Record<string, unknown>),
        );
        const pg = data.additional_data?.pagination;
        return ok(
          `${data.data?.length ?? 0} update(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL MAIL MESSAGES ──────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_mail_messages",
    {
      title: "List Deal Mail Messages",
      description: `List email messages associated with a deal (v1 API).

Returns mail threads linked to this deal via Smart BCC or email sync.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          start: z.number().int().min(0).default(0),
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
          `/api/v1/deals/${deal_id}/mailMessages`,
          compactBody({ start, limit }),
        );
        const pg = data.additional_data?.pagination;
        return ok(
          `${data.data?.length ?? 0} message(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── DEAL PERMITTED USERS ────────────────────────────────────────────────────
  server.registerTool(
    "pipedrive_list_deal_permitted_users",
    {
      title: "List Deal Permitted Users",
      description: `List users who are permitted to access a specific deal (v1 API).

Returns user objects with access level. Useful for visibility/permission auditing.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id }) => {
      try {
        const data = await client.get<{ success: boolean; data: unknown[] }>(
          `/api/v1/deals/${deal_id}/permittedUsers`,
        );
        return ok(
          `${data.data?.length ?? 0} permitted user(s).\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
