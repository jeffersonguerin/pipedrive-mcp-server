// src/tools/activities.ts — Pipedrive Activities API v2
// v2 released: December 19, 2024 (BETA). Stable since March 13, 2025.
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

export function registerActivityTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  server.registerTool(
    "pipedrive_list_activities",
    {
      title: "List Activities",
      description: `List activities with cursor pagination (v2, launched Dec 2024).

Replaces v1 sub-resource endpoints:
  GET /v1/persons/:id/activities → use person_id filter
  GET /v1/organizations/:id/activities → use org_id filter
  GET /v1/deals/:id/activities → use deal_id filter

Filters available:
  - filter_id: use a saved Pipedrive filter
  - ids: comma-separated list of up to 100 activity IDs (ignored if filter_id provided)
  - owner_id, deal_id, lead_id, person_id, org_id: entity filters
  - done: true=completed, false=open/pending
  - updated_since / updated_until: RFC3339 format (e.g. 2025-01-01T10:20:00Z)

include_fields: attendees (not in default response).

v2 field changes: owner_id (was user_id), creator_user_id (was created_by_user_id),
busy (was busy_flag), location is nested object, is_deleted replaces is_active.`,
      inputSchema: z
        .object({
          filter_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Use a saved Pipedrive filter"),
          ids: z
            .string()
            .optional()
            .describe(
              "Comma-separated activity IDs (up to 100); ignored if filter_id set",
            ),
          owner_id: z
            .number()
            .int()
            .nonnegative()
            .optional()
            .describe("Filter by owner user ID. Use 0 for all users."),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Filter by primary participant person ID"),
          deal_id: z.number().int().positive().optional(),
          lead_id: z
            .string()
            .optional()
            .describe("Filter by lead ID (UUID string)"),
          org_id: z.number().int().positive().optional(),
          done: z
            .boolean()
            .optional()
            .describe("true=completed, false=open/pending"),
          updated_since: z
            .string()
            .optional()
            .describe(
              "RFC3339 datetime: return activities updated at or after this time (e.g. 2025-01-01T10:20:00Z)",
            ),
          updated_until: z
            .string()
            .optional()
            .describe(
              "RFC3339 datetime: return activities updated before this time",
            ),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
          sort_by: z
            .enum(["id", "add_time", "update_time", "due_date"])
            .default("id")
            .describe("Sort field (default: id, as per Pipedrive API default)"),
          sort_direction: z.enum(["asc", "desc"]).default("asc"),
          include_fields: z.string().optional().describe("Optional: attendees"),
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
          "/api/v2/activities",
          compactBody(normalizeFilters(params as Record<string, unknown>)),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data.length} activity/ies.${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_activity",
    {
      title: "Get Activity",
      description: `Get a single activity by ID (v2). Use include_fields=attendees for attendee list.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Activity ID"),
          include_fields: z.string().optional().describe("Optional: attendees"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, include_fields }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v2/activities/${id}`,
          compactBody({ include_fields }),
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_create_activity",
    {
      title: "Create Activity",
      description: `Create a new activity (v2). Required: subject, type.

type must match a key_string from ActivityTypes (use pipedrive_list_activity_types to see valid values).
Common defaults: call, meeting, task, deadline, email, lunch.

Linking a person: you can set person_id directly OR use the participants array:
  participants: [{ person_id: 123, primary: true }]
Both are supported in v2.

due_date: YYYY-MM-DD | due_time: HH:MM (24h) | duration: HH:MM
location: nested object — { value: "address string", ... }
priority: integer, map to labels via pipedrive_list_activity_fields.
project_id: link to a Pipedrive Projects entity.`,
      inputSchema: z
        .object({
          subject: z
            .string()
            .min(1)
            .describe("Activity subject/title (required)"),
          type: z
            .string()
            .min(1)
            .describe(
              "Activity type key_string (required). Use pipedrive_list_activity_types to list valid values.",
            ),
          due_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("YYYY-MM-DD"),
          due_time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional()
            .describe("HH:MM (24h)"),
          duration: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional()
            .describe("HH:MM"),
          owner_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Owner user ID (was user_id in v1)"),
          deal_id: z.number().int().positive().optional(),
          lead_id: z.string().optional().describe("Lead ID (UUID)"),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Person ID (can also be set via participants array)"),
          org_id: z.number().int().positive().optional(),
          project_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Pipedrive Project ID"),
          note: z
            .string()
            .optional()
            .describe("Activity note (HTML allowed, max 100KB since Sep 2025)"),
          public_description: z.string().optional(),
          done: z
            .boolean()
            .optional()
            .describe("Mark as completed on creation"),
          busy: z
            .boolean()
            .optional()
            .describe("Mark time as busy in calendar (was busy_flag in v1)"),
          private: z.boolean().optional(),
          priority: z
            .number()
            .int()
            .optional()
            .describe(
              "Priority integer (map via pipedrive_list_activity_fields)",
            ),
          participants: z
            .array(
              z
                .object({
                  person_id: z.number().int().positive(),
                  primary: z
                    .boolean()
                    .optional()
                    .describe(
                      "Primary participant (also sets activity.person_id)",
                    ),
                })
                .strict(),
            )
            .optional()
            .describe("Activity participants"),
          attendees: z
            .array(
              z
                .object({
                  email_address: z
                    .string()
                    .describe(
                      "Attendee email address (string, not validated as email to handle all Pipedrive formats)",
                    ),
                  name: z.string().optional(),
                  status: z
                    .string()
                    .optional()
                    .describe("accepted | declined | tentative"),
                  person_id: z.number().int().positive().optional(),
                  user_id: z.number().int().positive().optional(),
                })
                .strict(),
            )
            .optional()
            .describe("Calendar attendees with email addresses"),
          location: z
            .object({
              value: z.string().describe("Address string"),
            })
            .passthrough()
            .optional()
            .describe("Location object (was flat location_* fields in v1)"),
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
          "/api/v2/activities",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Activity created.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_activity",
    {
      title: "Update Activity",
      description: `Update an activity via PATCH (v2). Only include fields to change.

To mark as done: done=true. To reopen: done=false.
person_id can be set directly or via participants array (both work in v2).`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Activity ID to update"),
          subject: z.string().min(1).optional(),
          type: z.string().optional().describe("Activity type key_string"),
          due_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          due_time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          duration: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .optional(),
          owner_id: z.number().int().positive().optional(),
          deal_id: z.number().int().positive().optional(),
          lead_id: z.string().optional(),
          person_id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Set person directly or via participants"),
          org_id: z.number().int().positive().optional(),
          project_id: z.number().int().positive().optional(),
          note: z
            .string()
            .optional()
            .describe("Activity note (HTML allowed, max 100KB since Sep 2025)"),
          done: z.boolean().optional().describe("true=mark done, false=reopen"),
          busy: z.boolean().optional(),
          private: z.boolean().optional(),
          priority: z.number().int().optional(),
          participants: z
            .array(
              z
                .object({
                  person_id: z.number().int().positive(),
                  primary: z.boolean().optional(),
                })
                .strict(),
            )
            .optional(),
          attendees: z
            .array(
              z
                .object({
                  email_address: z.string().describe("Attendee email address"),
                  name: z.string().optional(),
                  status: z.string().optional(),
                  person_id: z.number().int().positive().optional(),
                  user_id: z.number().int().positive().optional(),
                })
                .strict(),
            )
            .optional(),
          location: z.object({ value: z.string() }).passthrough().optional(),
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
          `/api/v2/activities/${id}`,
          compactBody(fields as Record<string, unknown>),
        );
        return ok(`Activity ${id} updated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_activity",
    {
      title: "Delete Activity",
      description: `Soft-delete an activity (v2). Permanently removed after 30 days.`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("Activity ID"),
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
        await client.del(`/api/v2/activities/${id}`);
        return ok(
          `Activity ${id} deleted (soft). Permanently removed after 30 days.`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
