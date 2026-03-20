// src/tools/contacts_extra.ts — Pipedrive Persons & Organizations sub-resources (v1.3.0)
// DRY: Both entities share identical sub-resource shapes (changelog, files, flow, mail, permitted, follower changelog).
// Persons has one extra: products.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV1 } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

// ─── Shared sub-resource registration (DRY) ──────────────────────────────────

interface ContactEntityConfig {
  entity: string;            // "person" or "organization"
  entityLabel: string;       // "Person" or "Organization"
  idParam: string;           // "person_id" or "org_id"
  v1Path: string;            // "/api/v1/persons" or "/api/v1/organizations"
  v2Path: string;            // "/api/v2/persons" or "/api/v2/organizations"
}

function registerContactSubResources(
  server: McpServer,
  client: PipedriveClient,
  cfg: ContactEntityConfig,
): void {
  const { entity, entityLabel, idParam, v1Path, v2Path } = cfg;

  // ── CHANGELOG ─────────────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_changelog`, {
    title: `List ${entityLabel} Changelog`,
    description: `List field value changes (audit trail) for a ${entityLabel.toLowerCase()} (v1 API, cursor-paginated).

Returns chronological list of field changes: field_key, old_value, new_value, time, user_id.
Useful for auditing who changed what and when.`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        `${v1Path}/${id}/changelog`, compactBody({ cursor: params.cursor as string | undefined, limit: params.limit as number }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── FILES ─────────────────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_files`, {
    title: `List ${entityLabel} Files`,
    description: `List files attached to a ${entityLabel.toLowerCase()} (v1 API).

Returns: id, name, file_type, file_size, url (signed download link), add_time.
Alternative: use pipedrive_list_files with ${idParam} param.`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
      start: z.number().int().min(0).default(0).describe("Pagination offset"),
      limit: z.number().int().min(1).max(100).default(50),
      sort: z.string().optional().describe("e.g. 'update_time DESC'"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<ListResponseV1<unknown>>(
        `${v1Path}/${id}/files`, compactBody({ start: params.start as number, limit: params.limit as number, sort: params.sort as string | undefined }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} file(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── FLOW / UPDATES ────────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_updates`, {
    title: `List ${entityLabel} Updates`,
    description: `List activity feed / updates about a ${entityLabel.toLowerCase()} (v1 API).

Returns events: notes added, activities completed, emails sent, field changes, etc.
items: comma-separated filter (activity, plannedActivity, note, file, change, deal, follower, participant, mailMessage, mailMessageWithAttachment, invoice, activityFile, document).`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
      all_changes: z.number().int().min(0).max(1).optional().describe("1=include custom field changes"),
      items: z.string().optional().describe("Comma-separated event types to include"),
      start: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<ListResponseV1<unknown>>(
        `${v1Path}/${id}/flow`, compactBody({
          all_changes: params.all_changes as number | undefined,
          items: params.items as string | undefined,
          start: params.start as number,
          limit: params.limit as number,
        }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} update(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── FOLLOWER CHANGELOG ────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_follower_changelog`, {
    title: `List ${entityLabel} Follower Changelog`,
    description: `List changelog of follower additions/removals for a ${entityLabel.toLowerCase()} (v2 API).

Returns: user_id, action (added/removed), time.`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<{ success: boolean; data: unknown[]; additional_data?: { next_cursor?: string } }>(
        `${v2Path}/${id}/followers/changelog`, compactBody({ cursor: params.cursor as string | undefined, limit: params.limit as number }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data?.length ?? 0} follower change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── MAIL MESSAGES ─────────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_mail_messages`, {
    title: `List ${entityLabel} Mail Messages`,
    description: `List email messages associated with a ${entityLabel.toLowerCase()} (v1 API).

Returns mail threads linked via Smart BCC or email sync.`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
      start: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<ListResponseV1<unknown>>(
        `${v1Path}/${id}/mailMessages`, compactBody({ start: params.start as number, limit: params.limit as number }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} message(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── PERMITTED USERS ───────────────────────────────────────────────────────
  server.registerTool(`pipedrive_list_${entity}_permitted_users`, {
    title: `List ${entityLabel} Permitted Users`,
    description: `List users who have access to a specific ${entityLabel.toLowerCase()} (v1 API).

Returns user objects with access level. Useful for visibility/permission auditing.`,
    inputSchema: z.object({
      [idParam]: z.number().int().positive().describe(`${entityLabel} ID`),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params: Record<string, unknown>) => {
    try {
      const id = params[idParam] as number;
      const data = await client.get<{ success: boolean; data: unknown[] }>(
        `${v1Path}/${id}/permittedUsers`);
      return ok(`${data.data?.length ?? 0} permitted user(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });
}

// ─── Main registration ──────────────────────────────────────────────────────

export function registerContactExtraTools(server: McpServer, client: PipedriveClient): void {

  // Register shared sub-resources for Persons (6 tools)
  registerContactSubResources(server, client, {
    entity: "person",
    entityLabel: "Person",
    idParam: "person_id",
    v1Path: "/api/v1/persons",
    v2Path: "/api/v2/persons",
  });

  // Register shared sub-resources for Organizations (6 tools)
  registerContactSubResources(server, client, {
    entity: "organization",
    entityLabel: "Organization",
    idParam: "org_id",
    v1Path: "/api/v1/organizations",
    v2Path: "/api/v2/organizations",
  });

  // ── PERSON-ONLY: Products associated with a person ──────────────────────
  server.registerTool("pipedrive_list_person_products", {
    title: "List Person Products",
    description: `List products associated with a person (v1 API).

Returns products that are attached to deals linked to this person.
Note: This is a convenience endpoint — equivalent to finding deals for a person and listing their products.`,
    inputSchema: z.object({
      person_id: z.number().int().positive().describe("Person ID"),
      start: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ person_id, start, limit }) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>(
        `/api/v1/persons/${person_id}/products`, compactBody({ start, limit }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} product(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });
}
