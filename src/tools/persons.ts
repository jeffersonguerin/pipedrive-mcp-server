// src/tools/persons.ts — Pipedrive Persons API v2
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

const PhoneEmailSchema = z.object({
  value: z.string().describe("Phone number or email address"),
  label: z
    .string()
    .optional()
    .describe("Label: work | home | mobile | other (default: work)"),
  primary: z.boolean().optional().describe("Only one per type can be primary"),
});

export function registerPersonTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  server.registerTool(
    "pipedrive_list_persons",
    {
      title: "List Persons",
      description: `List persons (contacts) with cursor pagination (v2).

Filters: filter_id, ids, owner_id, org_id, deal_id, updated_since, updated_until.
  - filter_id: use a saved Pipedrive filter (overrides other filters)
  - ids: comma-separated list of up to 100 person IDs
  - deal_id: filter persons linked to a specific deal
  - updated_since / updated_until: RFC3339 format

sort_by: id | update_time | add_time (v2 only supports these 3)
custom_fields: comma-separated keys to include (max 15, reduces payload).

v2: phones/emails are renamed arrays; is_deleted replaces active_flag (negated).`,
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
            .describe("Comma-separated person IDs (up to 100)"),
          owner_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner user ID. Use 0 for all users."),
          org_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by organization ID"),
          name: z
            .string()
            .optional()
            .describe("Filter persons by name (partial match)"),
          deal_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by linked deal ID"),
          updated_since: z
            .string()
            .optional()
            .describe(
              "RFC3339: persons updated at or after (e.g. 2025-01-01T10:20:00Z)",
            ),
          updated_until: z
            .string()
            .optional()
            .describe("RFC3339: persons updated before"),
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
            .describe(
              "Comma-separated optional fields (see get_person for list)",
            ),
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
          "/api/v2/persons",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} person(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_person",
    {
      title: "Get Person",
      description: `Get a single person by ID (v2).

include_fields (not returned by default): next_activity_id, last_activity_id,
open_deals_count, related_open_deals_count, closed_deals_count, related_closed_deals_count,
participant_open_deals_count, participant_closed_deals_count, email_messages_count,
activities_count, done_activities_count, undone_activities_count, files_count, notes_count,
followers_count, won_deals_count, related_won_deals_count, lost_deals_count,
related_lost_deals_count, last_incoming_mail_time, last_outgoing_mail_time, smart_bcc_email,
marketing_status (requires Campaigns product), doi_status (requires Campaigns product).
custom_fields: comma-separated keys to include (max 15).`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Person ID"),
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
          `/api/v2/persons/${id}`,
          compactBody({ include_fields, custom_fields }),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_create_person",
    {
      title: "Create Person",
      description: `Create a new person (v2). Required: name (or first_name + last_name).

v2 format:
  - phones/emails: array of { value, label?, primary? }
  - label_ids: array of integers
  - visible_to: 1=Owner, 3=Company, 5=Owner's group, 7=Everyone
  - marketing_status: no_consent | unsubscribed | subscribed | archived (requires Campaigns product)
  - custom_fields: nested object

Name rules: provide name OR (first_name + last_name). Both can't be empty strings.`,
      inputSchema: z
        .object({
          name: z
            .string()
            .min(1)
            .optional()
            .describe("Full name (or provide first_name + last_name)"),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          org_id: z.number().int().positive().optional(),
          owner_id: z.number().int().positive().optional(),
          phones: z
            .array(PhoneEmailSchema)
            .optional()
            .describe("Phone numbers"),
          emails: z
            .array(PhoneEmailSchema)
            .optional()
            .describe("Email addresses"),
          label_ids: z.array(z.number().int()).optional(),
          visible_to: z
            .number()
            .int()
            .optional()
            .describe("Visibility: 1, 3, 5, or 7"),
          marketing_status: z
            .enum(["no_consent", "unsubscribed", "subscribed", "archived"])
            .optional()
            .describe("Marketing consent status (requires Campaigns product)"),
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
          "/api/v2/persons",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Person created.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_person",
    {
      title: "Update Person",
      description: `Update a person via PATCH (v2). Only include fields to change.

WARNING: phones/emails arrays are fully REPLACED when sent. Include all values to keep.
marketing_status can only be changed once from old to new value.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Person ID to update"),
          name: z.string().min(1).optional(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          org_id: z.number().int().positive().optional(),
          owner_id: z.number().int().positive().optional(),
          phones: z
            .array(PhoneEmailSchema)
            .optional()
            .describe("Replaces existing phones array"),
          emails: z
            .array(PhoneEmailSchema)
            .optional()
            .describe("Replaces existing emails array"),
          label_ids: z.array(z.number().int()).optional(),
          visible_to: z.number().int().optional(),
          marketing_status: z
            .enum(["no_consent", "unsubscribed", "subscribed", "archived"])
            .optional()
            .describe("Marketing consent status (can only change once)"),
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
          `/api/v2/persons/${id}`,
          compactBody(fields as Record<string, unknown>),
        );
        return ok(`Person ${id} updated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_person",
    {
      title: "Delete Person",
      description: `Soft-delete a person (v2). Permanently removed after 30 days.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Person ID"),
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
        await client.del(`/api/v2/persons/${id}`);
        return ok(`Person ${id} deleted (soft).`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_search_persons",
    {
      title: "Search Persons",
      description: `Search persons by name, email, phone, notes, or custom fields (v2).

Searchable fields: name, email, phone, notes, custom_fields.
include_fields: person.picture (include picture URLs in results).
IMPORTANT: Use organization_id (not org_id) to filter by organization.`,
      inputSchema: z
        .object({
          term: z
            .string()
            .min(1)
            .describe("Search term (min 2 chars unless exact_match=true)"),
          fields: z
            .string()
            .optional()
            .describe("Fields: name, email, phone, notes, custom_fields"),
          exact_match: z.boolean().optional(),
          organization_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              "Filter by organization ID (note: organization_id, not org_id)",
            ),
          include_fields: z
            .string()
            .optional()
            .describe("Optional: person.picture"),
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
          "/api/v2/persons/search",
          compactBody(params as Record<string, unknown>),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} person(s) for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_merge_persons",
    {
      title: "Merge Two Persons",
      description: `Merge two persons into one (v1 API with PUT).

merge_with_id is the person whose data is KEPT (prioritized) in case of conflicts.
The person identified by 'id' (the first param) will be merged into merge_with_id and deleted.
All deals, activities, notes of the merged person will be transferred to merge_with_id.`,
      inputSchema: z
        .object({
          id: z
            .number()
            .int()
            .positive()
            .describe("Person ID that will be merged and deleted"),
          merge_with_id: z
            .number()
            .int()
            .positive()
            .describe(
              "Person ID to keep (data from this person is prioritized)",
            ),
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
          `/api/v1/persons/${id}/merge`,
          { merge_with_id },
        );
        return ok(
          `Person ${id} merged into person ${merge_with_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_list_person_followers",
    {
      title: "List Person Followers",
      description: `List users following a person (v2 API).

Returns: user_id, add_time (RFC3339).`,
      inputSchema: z
        .object({
          person_id: z.number().int().positive().describe("Person ID"),
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
    async ({ person_id, cursor, limit }) => {
      try {
        const data = await client.get<ListResponseV2<unknown>>(
          `/api/v2/persons/${person_id}/followers`,
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
    "pipedrive_add_person_follower",
    {
      title: "Add Person Follower",
      description: `Add a user as a follower of a person (v2 API). Returns 400 if already following.`,
      inputSchema: z
        .object({
          person_id: z.number().int().positive().describe("Person ID"),
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
    async ({ person_id, user_id }) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(
          `/api/v2/persons/${person_id}/followers`,
          { user_id },
        );
        return ok(
          `User ${user_id} added as follower.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_person_follower",
    {
      title: "Delete Person Follower",
      description: `Remove a user from a person's followers (v2 API). Use the user_id (not follower object ID).`,
      inputSchema: z
        .object({
          person_id: z.number().int().positive().describe("Person ID"),
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
    async ({ person_id, user_id }) => {
      try {
        await client.del(`/api/v2/persons/${person_id}/followers/${user_id}`);
        return ok(
          `User ${user_id} removed as follower from person ${person_id}.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
