// src/tools/lead_labels.ts — Pipedrive Lead Labels CRUD (v1.4.0)
// Lead labels use UUID identifiers (unlike deal label_ids which are integers).
// GET list is already in utilities.ts (pipedrive_list_lead_labels).
// This file adds GET one, POST, PATCH, DELETE.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerLeadLabelTools(server: McpServer, client: PipedriveClient): void {

  // ── GET ONE LEAD LABEL ──────────────────────────────────────────────────────
  server.registerTool("pipedrive_get_lead_label", {
    title: "Get Lead Label",
    description: `Get details of a specific lead label by UUID (v1 API).

Returns: id (UUID), name, color, add_time, update_time.

Lead label IDs are UUIDs (e.g. '4b8e87bf-1234-5678-abcd-ef0123456789'),
NOT integers like deal labels. Use pipedrive_list_lead_labels to discover available labels.

Args:
  - id (string): Lead label UUID (required)

Returns:
  Label object with id, name, color.`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead label UUID (e.g. '4b8e87bf-...')"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/leadLabels/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── CREATE LEAD LABEL ───────────────────────────────────────────────────────
  server.registerTool("pipedrive_create_lead_label", {
    title: "Create Lead Label",
    description: `Create a new lead label (v1 API). Required: name, color.

Labels are used to categorize leads in the Leads Inbox.
The API will generate a UUID for the new label.

Args:
  - name (string): Label name — must be unique (required)
  - color (string): Label color — must be one of Pipedrive's predefined colors (required).
    Valid values: green, blue, red, yellow, purple, gray.

Returns:
  The created label object with its generated UUID.

Example:
  { name: "Hot Lead", color: "red" } → creates a red "Hot Lead" label.`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Label name — must be unique (required)"),
      color: z.enum(["green", "blue", "red", "yellow", "purple", "gray"]).describe("Label color (required)"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v1/leadLabels", compactBody(params as Record<string, unknown>));
      return ok(`Lead label created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── UPDATE LEAD LABEL ───────────────────────────────────────────────────────
  server.registerTool("pipedrive_update_lead_label", {
    title: "Update Lead Label",
    description: `Update an existing lead label (v1 API — uses PATCH).

Only include fields to change. Name must remain unique if changed.

Args:
  - id (string): Lead label UUID (required)
  - name (string): New label name
  - color (string): New color: green, blue, red, yellow, purple, gray

Returns:
  Updated label object.`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead label UUID"),
      name: z.string().min(1).optional().describe("New label name"),
      color: z.enum(["green", "blue", "red", "yellow", "purple", "gray"]).optional().describe("New label color"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v1/leadLabels/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Lead label ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  // ── DELETE LEAD LABEL ───────────────────────────────────────────────────────
  server.registerTool("pipedrive_delete_lead_label", {
    title: "Delete Lead Label",
    description: `Delete a lead label (v1 API). Permanent deletion.

WARNING: Leads that have this label assigned will lose the label.
Use pipedrive_list_lead_labels to see all labels before deleting.

Args:
  - id (string): Lead label UUID (required)`,
    inputSchema: z.object({
      id: z.string().uuid().describe("Lead label UUID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/leadLabels/${id}`);
      return ok(`Lead label ${id} deleted.`);
    } catch (e) { return err(e); }
  });
}
