// src/tools/users_extra.ts — Pipedrive Users extended endpoints (v1.4.0)
// GET user by ID, user permissions, user followers.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse, ListResponseV2 } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerUserExtraTools(server: McpServer, client: PipedriveClient): void {

  // ── GET USER BY ID ──────────────────────────────────────────────────────────
  server.registerTool("pipedrive_get_user", {
    title: "Get User",
    description: `Get details of a specific user by ID (v1 API).

Returns: id, name, email, phone, lang, timezone_name, timezone_offset,
company_id, company_name, company_domain, is_admin, active_flag, role_id,
icon_url, is_you (whether this is the authenticated user).

Use pipedrive_get_current_user for the authenticated user, or this tool when you know a specific user ID
(e.g. from owner_id or user_id fields on deals, activities, etc.).

Args:
  - id (number): User ID (required)

Returns:
  Full user object with profile info, role, and company details.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("User ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/users/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── USER PERMISSIONS ────────────────────────────────────────────────────────
  server.registerTool("pipedrive_get_user_permissions", {
    title: "Get User Permissions",
    description: `Get permission settings for a specific user (v1 API).

Returns a flat object of permission flags (boolean) like:
  can_add_deals, can_delete_deals, can_export_data_from_lists,
  can_see_company_wide_statistics, can_see_deals_list_summary, etc.

Useful for checking what a user is allowed to do before attempting an operation.

Args:
  - id (number): User ID (required)

Returns:
  Object with boolean permission flags.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("User ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/users/${id}/permissions`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── USER FOLLOWERS ──────────────────────────────────────────────────────────
  server.registerTool("pipedrive_list_user_followers", {
    title: "List User Followers",
    description: `List users who are following a specific user (v2 API).

Returns: user_id, add_time.
Following a user means receiving notifications about their activity.

Args:
  - user_id (number): User ID to get followers for (required)
  - cursor (string): Pagination cursor from previous response
  - limit (number): Results per page (default 50, max 500)

Returns:
  Array of follower objects with user_id and add_time.`,
    inputSchema: z.object({
      user_id: z.number().int().positive().describe("User ID to get followers for"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
      limit: z.number().int().min(1).max(500).default(50).describe("Results per page"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ user_id, cursor, limit }) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>(
        `/api/v2/users/${user_id}/followers`, compactBody({ cursor, limit }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data.length} follower(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });
}
