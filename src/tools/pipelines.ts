// src/tools/pipelines.ts — Pipedrive Pipelines & Stages API v2
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV2, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerPipelineTools(server: McpServer, client: PipedriveClient): void {

  // ── PIPELINES ───────────────────────────────────────────────────────────────

  server.registerTool("pipedrive_list_pipelines", {
    title: "List Pipelines",
    description: `List all sales pipelines (v2).

v2 field changes: is_deleted (was active, negated), is_deal_probability_enabled (was deal_probability),
url_title removed, order_nr is read-only. NOTE: is_selected was documented in v2 migration guide but was NEVER returned in the API response — field does not exist in practice.`,
    inputSchema: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
      sort_by: z.enum(["id","name","add_time","update_time"]).default("id").describe("Sort field"),
      sort_direction: z.enum(["asc","desc"]).default("asc"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ cursor, limit, sort_by, sort_direction }) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>("/api/v2/pipelines", compactBody({ cursor, limit, sort_by, sort_direction }));
      return ok(`${data.data.length} pipeline(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_pipeline", {
    title: "Get Pipeline",
    description: `Get a single pipeline by ID (v2).`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Pipeline ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v2/pipelines/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_pipeline", {
    title: "Create Pipeline",
    description: `Create a pipeline (v2). Required: name. New pipeline is placed last (order_nr read-only).`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Pipeline name (required)"),
      is_deal_probability_enabled: z.boolean().optional().describe("Enable win probability feature"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v2/pipelines", compactBody(params as Record<string, unknown>));
      return ok(`Pipeline created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_pipeline", {
    title: "Update Pipeline",
    description: `Update a pipeline via PATCH (v2).`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Pipeline ID to update"),
      name: z.string().min(1).optional(),
      is_deal_probability_enabled: z.boolean().optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v2/pipelines/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Pipeline ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_pipeline", {
    title: "Delete Pipeline",
    description: `Delete a pipeline (v2). WARNING: Also deletes all stages and deals in the pipeline. Irreversible.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Pipeline ID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v2/pipelines/${id}`);
      return ok(`Pipeline ${id} deleted.`);
    } catch (e) { return err(e); }
  });

  // ── STAGES ──────────────────────────────────────────────────────────────────

  server.registerTool("pipedrive_list_stages", {
    title: "List Stages",
    description: `List stages, optionally filtered by pipeline_id (v2).

v2 field changes: is_deleted (was active_flag, negated), is_deal_rot_enabled (was rotten_flag),
days_to_rotten (was rotten_days). pipeline_name and pipeline_deal_probability removed.`,
    inputSchema: z.object({
      pipeline_id: z.number().int().positive().optional().describe("Filter by pipeline ID"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
      sort_by: z.enum(["id","add_time","update_time","order_nr"]).default("order_nr").describe("Sort field. order_nr sorts by position in pipeline (default)."),
      sort_direction: z.enum(["asc","desc"]).default("asc"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ pipeline_id, cursor, limit, sort_by, sort_direction }) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>("/api/v2/stages", compactBody({ pipeline_id, cursor, limit, sort_by, sort_direction }));
      return ok(`${data.data.length} stage(s).\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_stage", {
    title: "Get Stage",
    description: `Get a single stage by ID (v2).`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Stage ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v2/stages/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_stage", {
    title: "Create Stage",
    description: `Create a stage in a pipeline (v2). Required: name, pipeline_id.`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Stage name (required)"),
      pipeline_id: z.number().int().positive().describe("Pipeline ID (required)"),
      deal_probability: z.number().int().min(0).max(100).optional().describe("Win probability (0-100)"),
      is_deal_rot_enabled: z.boolean().optional().describe("Enable deal rotting"),
      days_to_rotten: z.number().int().positive().optional().describe("Days until deal rots"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v2/stages", compactBody(params as Record<string, unknown>));
      return ok(`Stage created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_stage", {
    title: "Update Stage",
    description: `Update a stage via PATCH (v2). Only include fields to change.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Stage ID to update"),
      name: z.string().min(1).optional(),
      deal_probability: z.number().int().min(0).max(100).optional(),
      is_deal_rot_enabled: z.boolean().optional(),
      days_to_rotten: z.number().int().positive().optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v2/stages/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Stage ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_stage", {
    title: "Delete Stage",
    description: `Delete a stage by ID (v2).

WARNING: Deleting a stage that contains deals will move those deals to the previous stage.
If no previous stage exists, the deals will be moved to the next stage.
This action cannot be undone.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Stage ID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v2/stages/${id}`);
      return ok(`Stage ${id} deleted. Any deals in this stage were moved to an adjacent stage.`);
    } catch (e) { return err(e); }
  });
}
