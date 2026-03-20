// src/tools/files.ts — Pipedrive Files API v1 (no v2 equivalent yet)
// Files can be attached to deals, persons, organizations, leads, notes, etc.
// NOTE: File upload is NOT supported via this MCP (requires multipart/form-data).
// This module provides list, get (metadata), and delete operations.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV1, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerFileTools(server: McpServer, client: PipedriveClient): void {

  server.registerTool("pipedrive_list_files", {
    title: "List Files",
    description: `List files (v1 API). Can filter by entity type and ID.

sort: id, name, add_time, update_time (append ' ASC' or ' DESC').

include_deleted_files: 0 or 1 (0=only active, 1=include deleted).

To list files attached to a specific entity, provide the entity and its ID:
  - deal_id, person_id, org_id, lead_id, activity_id, product_id, project_id, note_id, log_id.

Returns: id, name, file_type, file_size, url (download URL, expires), add_time, update_time.`,
    inputSchema: z.object({
      deal_id: z.number().int().positive().optional().describe("Filter by deal"),
      person_id: z.number().int().positive().optional().describe("Filter by person"),
      org_id: z.number().int().positive().optional().describe("Filter by organization"),
      lead_id: z.string().optional().describe("Filter by lead (UUID)"),
      activity_id: z.number().int().positive().optional().describe("Filter by activity"),
      product_id: z.number().int().positive().optional().describe("Filter by product"),
      project_id: z.number().int().positive().optional().describe("Filter by project"),
      sort: z.string().optional().describe("e.g. 'update_time DESC', 'name ASC'"),
      include_deleted_files: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      start: z.number().int().min(0).default(0).describe("Pagination offset (v1)"),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>("/api/v1/files", compactBody(params as Record<string, unknown>));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} file(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_file", {
    title: "Get File",
    description: `Get metadata of a single file (v1 API). Returns name, size, type, download URL.

The url field is a signed download URL that expires. Use it promptly if you need to download.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("File ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/files/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_file", {
    title: "Delete File",
    description: `Delete a file (v1 API). Permanent deletion.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("File ID"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/files/${id}`);
      return ok(`File ${id} deleted.`);
    } catch (e) { return err(e); }
  });
}
