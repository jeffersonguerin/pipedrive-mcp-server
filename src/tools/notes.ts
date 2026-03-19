// src/tools/notes.ts — Pipedrive Notes API v1 (no v2 equivalent)
// Max note size: ~100,000 characters (100KB)
// IMPORTANT: All updates use HTTP PUT (not PATCH)
// Notes support HTML content (sanitized server-side)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV1, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerNoteTools(server: McpServer, client: PipedriveClient): void {

  // ── LIST NOTES ──────────────────────────────────────────────────────────────
  server.registerTool("pipedrive_list_notes", {
    title: "List Notes",
    description: `List notes (v1 API — no v2 equivalent). Notes support HTML content (max ~100KB).

Filters: deal_id, lead_id (UUID), person_id, org_id, project_id, user_id.
Date filters: start_date, end_date (YYYY-MM-DD), updated_since (RFC3339).
Pinning filters: pinned_to_deal_flag, pinned_to_person_flag, pinned_to_organization_flag,
  pinned_to_lead_flag, pinned_to_project_flag.
sort: field ASC/DESC — supports: id, user_id, deal_id, person_id, org_id, content, add_time, update_time.`,
    inputSchema: z.object({
      deal_id: z.number().int().positive().optional().describe("Filter by deal ID"),
      lead_id: z.string().optional().describe("Filter by lead ID (UUID)"),
      person_id: z.number().int().positive().optional().describe("Filter by person ID"),
      org_id: z.number().int().positive().optional().describe("Filter by organization ID"),
      project_id: z.number().int().positive().optional().describe("Filter by project ID"),
      user_id: z.number().int().positive().optional().describe("Filter by author user ID"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("From date (YYYY-MM-DD)"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("To date (YYYY-MM-DD)"),
      updated_since: z.string().optional().describe("RFC3339: notes updated at or after (e.g. 2025-01-01T10:20:00Z)"),
      pinned_to_deal_flag: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      pinned_to_person_flag: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      pinned_to_organization_flag: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      pinned_to_lead_flag: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      pinned_to_project_flag: z.number().int().min(0).max(1).optional().describe("0 or 1"),
      limit: z.number().int().min(1).max(500).default(50),
      start: z.number().int().min(0).default(0).describe("Pagination offset (v1)"),
      sort: z.string().optional().describe("e.g. 'update_time DESC', 'add_time ASC'"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>("/api/v1/notes", compactBody(params as Record<string, unknown>));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} note(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── GET NOTE ────────────────────────────────────────────────────────────────
  server.registerTool("pipedrive_get_note", {
    title: "Get Note",
    description: `Get a single note by ID (v1 API).`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Note ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/notes/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── CREATE NOTE ─────────────────────────────────────────────────────────────
  server.registerTool("pipedrive_create_note", {
    title: "Create Note",
    description: `Create a note (v1 API). HTML content supported (sanitized server-side). Max ~100KB.

Attach to ONE of: deal_id, lead_id, person_id, org_id, project_id (at least one required).
add_time: set creation date/time in past or future (format: YYYY-MM-DD HH:MM:SS, UTC).
user_id: set author — admin only.
Pinning: pinned notes appear at top of entity's note list.`,
    inputSchema: z.object({
      content: z.string().min(1).describe("Note content in HTML format (sanitized server-side)"),
      deal_id: z.number().int().positive().optional().describe("Attach to deal"),
      lead_id: z.string().optional().describe("Attach to lead (UUID)"),
      person_id: z.number().int().positive().optional().describe("Attach to person"),
      org_id: z.number().int().positive().optional().describe("Attach to organization"),
      project_id: z.number().int().positive().optional().describe("Attach to project"),
      user_id: z.number().int().positive().optional().describe("Author user ID (admin only)"),
      add_time: z.string().optional().describe("Creation datetime UTC (YYYY-MM-DD HH:MM:SS); can be past or future"),
      pinned_to_deal_flag: z.number().int().min(0).max(1).optional().describe("0 or 1 (deal_id required)"),
      pinned_to_lead_flag: z.number().int().min(0).max(1).optional().describe("0 or 1 (lead_id required)"),
      pinned_to_person_flag: z.number().int().min(0).max(1).optional().describe("0 or 1 (person_id required)"),
      pinned_to_organization_flag: z.number().int().min(0).max(1).optional().describe("0 or 1 (org_id required)"),
      pinned_to_project_flag: z.number().int().min(0).max(1).optional().describe("0 or 1 (project_id required)"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v1/notes", compactBody(params as Record<string, unknown>));
      return ok(`Note created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── UPDATE NOTE ─────────────────────────────────────────────────────────────
  server.registerTool("pipedrive_update_note", {
    title: "Update Note",
    description: `Update a note (v1 API — uses HTTP PUT, not PATCH). Only include fields to change.

add_time: can be changed to past or future.
user_id: change author — admin only.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Note ID to update"),
      content: z.string().min(1).optional(),
      deal_id: z.number().int().positive().optional(),
      lead_id: z.string().optional().describe("Lead ID (UUID)"),
      person_id: z.number().int().positive().optional(),
      org_id: z.number().int().positive().optional(),
      project_id: z.number().int().positive().optional(),
      user_id: z.number().int().positive().optional().describe("Change author (admin only)"),
      add_time: z.string().optional().describe("Override creation datetime (YYYY-MM-DD HH:MM:SS UTC)"),
      pinned_to_deal_flag: z.number().int().min(0).max(1).optional(),
      pinned_to_lead_flag: z.number().int().min(0).max(1).optional(),
      pinned_to_person_flag: z.number().int().min(0).max(1).optional(),
      pinned_to_organization_flag: z.number().int().min(0).max(1).optional(),
      pinned_to_project_flag: z.number().int().min(0).max(1).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      // v1 Notes API uses PUT — do NOT change to client.patch
      const data = await client.put<SingleResponse<unknown>>(`/api/v1/notes/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Note ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── DELETE NOTE ─────────────────────────────────────────────────────────────
  server.registerTool("pipedrive_delete_note", {
    title: "Delete Note",
    description: `Permanently delete a note (v1 API). Deletion is immediate and irreversible.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Note ID"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/notes/${id}`);
      return ok(`Note ${id} deleted.`);
    } catch (e) { return err(e); }
  });

  // ── NOTE COMMENTS ───────────────────────────────────────────────────────────
  server.registerTool("pipedrive_list_note_comments", {
    title: "List Note Comments",
    description: `List all comments on a note (v1 API).

Comments are threaded replies to a note. Each has an ID (UUID), content (HTML), user_id, add_time, update_time.`,
    inputSchema: z.object({
      note_id: z.number().int().positive().describe("Note ID"),
      start: z.number().int().min(0).default(0).describe("Pagination offset"),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ note_id, start, limit }) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>(`/api/v1/notes/${note_id}/comments`, compactBody({ start, limit }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} comment(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_note_comment", {
    title: "Get Note Comment",
    description: `Get a specific comment on a note (v1 API). Comment IDs are UUIDs.`,
    inputSchema: z.object({
      note_id: z.number().int().positive().describe("Note ID"),
      comment_id: z.string().uuid().describe("Comment ID (UUID)"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ note_id, comment_id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/notes/${note_id}/comments/${comment_id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_add_note_comment", {
    title: "Add Note Comment",
    description: `Add a comment to a note (v1 API). Comments support HTML content (sanitized server-side).`,
    inputSchema: z.object({
      note_id: z.number().int().positive().describe("Note ID to comment on"),
      content: z.string().min(1).describe("Comment content in HTML format"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ note_id, content }) => {
    try {
      const data = await client.post<SingleResponse<unknown>>(`/api/v1/notes/${note_id}/comments`, { content });
      return ok(`Comment added to note ${note_id}.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_note_comment", {
    title: "Update Note Comment",
    description: `Update a comment on a note (v1 API — uses HTTP PUT). Comment IDs are UUIDs.`,
    inputSchema: z.object({
      note_id: z.number().int().positive().describe("Note ID"),
      comment_id: z.string().uuid().describe("Comment ID (UUID)"),
      content: z.string().min(1).describe("Updated comment content in HTML format"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ note_id, comment_id, content }) => {
    try {
      // v1 Note Comments API uses PUT
      const data = await client.put<SingleResponse<unknown>>(`/api/v1/notes/${note_id}/comments/${comment_id}`, { content });
      return ok(`Comment ${comment_id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_note_comment", {
    title: "Delete Note Comment",
    description: `Delete a comment from a note (v1 API). Deletion is immediate and irreversible.`,
    inputSchema: z.object({
      note_id: z.number().int().positive().describe("Note ID"),
      comment_id: z.string().uuid().describe("Comment ID (UUID)"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ note_id, comment_id }) => {
    try {
      await client.del(`/api/v1/notes/${note_id}/comments/${comment_id}`);
      return ok(`Comment ${comment_id} deleted from note ${note_id}.`);
    } catch (e) { return err(e); }
  });
}
