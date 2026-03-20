// src/tools/organizations.ts — Pipedrive Organizations API v2
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  PipedriveClient,
  ListResponseV2,
  SingleResponse,
} from "../client.ts";
import {
  ok,
  err,
  compactBody,
  normalizeFilters,
  serialize,
} from "../client.ts";

const AddressSchema = z
  .object({
    value: z.string().describe("Full address string (only required subfield)"),
    street_number: z.string().optional(),
    route: z.string().optional(),
    sublocality: z.string().optional(),
    locality: z.string().optional(),
    admin_area_level_1: z.string().optional(),
    admin_area_level_2: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional(),
    subpremise: z.string().optional(),
    formatted_address: z.string().optional(),
  })
  .describe(
    "Address object. v2: was flat address_* fields, now a nested object. Only 'value' is required.",
  );

export function registerOrganizationTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  server.registerTool(
    "pipedrive_list_organizations",
    {
      title: "List Organizations",
      description: `List organizations with cursor pagination (v2).

Filters: filter_id, ids, owner_id, updated_since, updated_until.
  - filter_id: saved Pipedrive filter (overrides other filters)
  - ids: comma-separated list of up to 100 org IDs
  - updated_since / updated_until: RFC3339 format

sort_by: id | update_time | add_time (v2 only supports these 3)
custom_fields: comma-separated keys to include (max 15).

v2: address is a nested object, is_deleted replaces active_flag.`,
      inputSchema: z
        .object({
          filter_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Saved Pipedrive filter ID"),
          ids: z
            .string()
            .optional()
            .describe("Comma-separated org IDs (up to 100)"),
          owner_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner user ID. Use 0 for all users."),
          name: z
            .string()
            .optional()
            .describe("Filter organizations by name (partial match)"),
          updated_since: z
            .string()
            .optional()
            .describe(
              "RFC3339: orgs updated at or after (e.g. 2025-01-01T10:20:00Z)",
            ),
          updated_until: z
            .string()
            .optional()
            .describe("RFC3339: orgs updated before"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z
            .enum(["id", "add_time", "update_time"])
            .default("add_time")
            .describe("Sort field (v2 supports: id, add_time, update_time)"),
          sort_direction: z.enum(["asc", "desc"]).default("desc"),
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
    async (params) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          "/api/v2/organizations",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} org(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_organization",
    {
      title: "Get Organization",
      description: `Get a single organization by ID (v2).

include_fields: next_activity_id, last_activity_id, open_deals_count, related_open_deals_count,
closed_deals_count, related_closed_deals_count, email_messages_count, people_count,
activities_count, done_activities_count, undone_activities_count, files_count, notes_count,
followers_count, won_deals_count, related_won_deals_count, lost_deals_count,
related_lost_deals_count, last_incoming_mail_time, last_outgoing_mail_time, smart_bcc_email.
custom_fields: comma-separated keys (max 15).`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Organization ID"),
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
    async ({ id, include_fields, custom_fields }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v2/organizations/${id}`,
          compactBody({ include_fields, custom_fields }),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_create_organization",
    {
      title: "Create Organization",
      description: `Create a new organization (v2). Required: name.

address: nested object { value: "...", route?, locality?, country?, ... } (only value required).
visible_to: 1=Owner, 3=Company, 5=Owner's group, 7=Everyone.`,
      inputSchema: z
        .object({
          name: z.string().min(1).describe("Organization name (required)"),
          owner_id: z.number().int().positive().optional(),
          address: AddressSchema.optional(),
          visible_to: z
            .number()
            .int()
            .optional()
            .describe("Visibility: 1, 3, 5, or 7"),
          label_ids: z.array(z.number().int()).optional(),
          custom_fields: z.record(z.unknown()).optional(),
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
          "/api/v2/organizations",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Organization created.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_organization",
    {
      title: "Update Organization",
      description: `Update an organization via PATCH (v2). Only include fields to change.

For address: only value is required; missing subfields default to null.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Organization ID"),
          name: z.string().min(1).optional(),
          owner_id: z.number().int().positive().optional(),
          address: AddressSchema.optional(),
          visible_to: z.number().int().optional(),
          label_ids: z.array(z.number().int()).optional(),
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
          `/api/v2/organizations/${id}`,
          compactBody(fields as Record<string, unknown>),
        );
        return ok(`Organization ${id} updated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_organization",
    {
      title: "Delete Organization",
      description: `Soft-delete an organization (v2). Permanently removed after 30 days.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Organization ID"),
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
        await client.del(`/api/v2/organizations/${id}`);
        return ok(`Organization ${id} deleted (soft).`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_search_organizations",
    {
      title: "Search Organizations",
      description: `Search organizations by name, address, notes, or custom fields (v2).

Searchable fields: name, address, notes, custom_fields.`,
      inputSchema: z
        .object({
          term: z
            .string()
            .min(1)
            .describe("Search term (min 2 chars unless exact_match=true)"),
          fields: z
            .string()
            .optional()
            .describe("Fields: name, address, notes, custom_fields"),
          exact_match: z.boolean().optional(),
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
          "/api/v2/organizations/search",
          compactBody(params as Record<string, unknown>),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} org(s) for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_merge_organizations",
    {
      title: "Merge Two Organizations",
      description: `Merge two organizations into one (v1 API with PUT).

merge_with_id is the organization whose data is KEPT (prioritized) in case of conflicts.
The organization identified by 'id' will be merged into merge_with_id and deleted.
All deals, persons, activities, notes are transferred to merge_with_id.`,
      inputSchema: z
        .object({
          id: z
            .number()
            .int()
            .positive()
            .describe("Organization ID that will be merged and deleted"),
          merge_with_id: z
            .number()
            .int()
            .positive()
            .describe("Organization ID to keep (data is prioritized)"),
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
          `/api/v1/organizations/${id}/merge`,
          { merge_with_id },
        );
        return ok(
          `Organization ${id} merged into ${merge_with_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_list_org_followers",
    {
      title: "List Organization Followers",
      description: `List users following an organization (v2 API). Returns: user_id, add_time.`,
      inputSchema: z
        .object({
          org_id: z.number().int().positive().describe("Organization ID"),
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
    async ({ org_id, cursor, limit }) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          `/api/v2/organizations/${org_id}/followers`,
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
    "pipedrive_add_org_follower",
    {
      title: "Add Organization Follower",
      description: `Add a user as a follower of an organization (v2 API). Returns 400 if already following.`,
      inputSchema: z
        .object({
          org_id: z.number().int().positive().describe("Organization ID"),
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
    async ({ org_id, user_id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/organizations/${org_id}/followers`,
          { user_id },
        );
        return ok(
          `User ${user_id} added as follower to org ${org_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_org_follower",
    {
      title: "Delete Organization Follower",
      description: `Remove a user from an organization's followers (v2 API). Use user_id (not follower object ID).`,
      inputSchema: z
        .object({
          org_id: z.number().int().positive().describe("Organization ID"),
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
    async ({ org_id, user_id }) => {
      try {
        await client.del(
          `/api/v2/organizations/${org_id}/followers/${user_id}`,
        );
        return ok(`User ${user_id} removed as follower from org ${org_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );
}
