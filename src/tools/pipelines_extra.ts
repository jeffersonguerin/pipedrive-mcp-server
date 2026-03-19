// src/tools/pipelines_extra.ts — Pipedrive Pipeline Analytics (v1.4.0)
// Conversion statistics and movement statistics for pipelines.
// Note: GET /v1/pipelines/{id}/deals is DEPRECATED — use pipedrive_list_deals with pipeline_id filter instead.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerPipelineExtraTools(server: McpServer, client: PipedriveClient): void {

  // ── PIPELINE CONVERSION STATISTICS ──────────────────────────────────────────
  server.registerTool("pipedrive_get_pipeline_conversion_stats", {
    title: "Get Pipeline Conversion Statistics",
    description: `Get stage-to-stage conversion rates and pipeline-to-close rates for a time period (v1 API).

Required: start_date, end_date (both YYYY-MM-DD).

Returns conversion percentages between each stage pair and overall pipeline-to-won rate.
This is the core metric for sales funnel analysis — shows where deals drop off.

Args:
  - pipeline_id (number): Pipeline ID (required)
  - start_date (string): Period start YYYY-MM-DD (required)
  - end_date (string): Period end YYYY-MM-DD (required)
  - user_id (number): Filter by owner. If omitted, uses authenticated user.

Returns:
  Stage-to-stage conversion rates, pipeline-to-close rate, counts per stage.

Example usage:
  "What's our conversion rate this quarter?" → pipeline_id=1, start_date=2026-01-01, end_date=2026-03-31`,
    inputSchema: z.object({
      pipeline_id: z.number().int().positive().describe("Pipeline ID (required)"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Period start YYYY-MM-DD (required)"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Period end YYYY-MM-DD (required)"),
      user_id: z.number().int().positive().optional().describe("Filter by owner user. Omit for authenticated user."),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ pipeline_id, start_date, end_date, user_id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(
        `/api/v1/pipelines/${pipeline_id}/conversion_statistics`,
        compactBody({ start_date, end_date, user_id }));
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── PIPELINE MOVEMENT STATISTICS ────────────────────────────────────────────
  server.registerTool("pipedrive_get_pipeline_movement_stats", {
    title: "Get Pipeline Movement Statistics",
    description: `Get deal movement statistics within a pipeline for a time period (v1 API).

Required: start_date, end_date (both YYYY-MM-DD).

Shows how many deals moved between stages, entered/left the pipeline, and won/lost during the period.
Essential for understanding pipeline velocity and deal flow health.

Args:
  - pipeline_id (number): Pipeline ID (required)
  - start_date (string): Period start YYYY-MM-DD (required)
  - end_date (string): Period end YYYY-MM-DD (required)
  - user_id (number): Filter by owner. If omitted, uses authenticated user.

Returns:
  movements_between_stages: { stage_id: { in, out } }, new_deals_count, deals_left_count,
  won_count, lost_count, average_age_in_days.

Example usage:
  "How many deals moved through the pipeline this month?" → pipeline_id=1, start_date=2026-03-01, end_date=2026-03-31`,
    inputSchema: z.object({
      pipeline_id: z.number().int().positive().describe("Pipeline ID (required)"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Period start YYYY-MM-DD (required)"),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Period end YYYY-MM-DD (required)"),
      user_id: z.number().int().positive().optional().describe("Filter by owner user. Omit for authenticated user."),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ pipeline_id, start_date, end_date, user_id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(
        `/api/v1/pipelines/${pipeline_id}/movement_statistics`,
        compactBody({ start_date, end_date, user_id }));
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });
}
