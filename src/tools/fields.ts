// src/tools/fields.ts — Pipedrive Fields API v2 (released Dec 10, 2025)
// Generic CRUD for custom fields across 4 entity types + options management.
// DealFields, PersonFields, OrganizationFields, ProductFields — identical API shape.
// ActivityFields — read-only (GET list already in utilities.ts, GET one added here).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

// ─── Shared schemas ──────────────────────────────────────────────────────────

const FIELD_TYPES = [
  "varchar", "varchar_auto", "text", "double", "monetary",
  "date", "daterange", "time", "timerange",
  "enum", "set", "phone", "address",
  "user", "org", "people",
] as const;

const OptionSchema = z.object({
  label: z.string().min(1).describe("Display label for the option (required)"),
  color: z.string().optional().describe("Optional HEX color code (e.g. '#ff0000')"),
});

const OptionUpdateSchema = z.object({
  id: z.number().int().positive().describe("Option ID to update"),
  label: z.string().min(1).describe("New label text"),
});

const UiVisibilitySchema = z.object({
  add_visible_flag: z.boolean().optional().describe("Show in add/create modal"),
  details_visible_flag: z.boolean().optional().describe("Show in detail view"),
}).optional().describe("UI visibility settings (web UI only)");

const ImportantFieldsSchema = z.object({
  stage_ids: z.array(z.number().int()).optional().describe("Stage IDs where field is highlighted"),
}).optional().describe("Configuration for highlighting field at specific stages");

const RequiredFieldsSchema = z.object({
  stage_ids: z.array(z.number().int()).optional().describe("Stage IDs where field is required"),
}).optional().describe("Required fields configuration for Pipedrive web UI");

// ─── Entity-specific config ──────────────────────────────────────────────────

interface FieldEntityConfig {
  entity: string;           // pipedrive_* prefix fragment
  entityLabel: string;      // Human-readable name
  basePath: string;         // /api/v2/dealFields etc.
}

const ENTITIES: FieldEntityConfig[] = [
  { entity: "deal_field",         entityLabel: "Deal Field",         basePath: "/api/v2/dealFields" },
  { entity: "person_field",       entityLabel: "Person Field",       basePath: "/api/v2/personFields" },
  { entity: "organization_field", entityLabel: "Organization Field", basePath: "/api/v2/organizationFields" },
  { entity: "product_field",      entityLabel: "Product Field",      basePath: "/api/v2/productFields" },
];

// ─── Registration ────────────────────────────────────────────────────────────

export function registerFieldTools(server: McpServer, client: PipedriveClient): void {

  // Register identical CRUD + options tools for each of the 4 field entities
  for (const cfg of ENTITIES) {
    const { entity, entityLabel, basePath } = cfg;

    // ── GET ONE ────────────────────────────────────────────────────────────
    server.registerTool(`pipedrive_get_${entity}`, {
      title: `Get ${entityLabel}`,
      description: `Get metadata for a single ${entityLabel.toLowerCase()} by field_code (v2 API).

field_code is the unique identifier — a 40-character hash for custom fields, or a standard field name (e.g. 'title', 'value', 'stage_id').

Returns: field_name, field_code, field_type, is_custom_field, options (for enum/set), subfields (for address/monetary).
include_fields: ui_visibility, important_fields, required_fields.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code (40-char hash for custom fields, or standard name like 'title')"),
        include_fields: z.string().optional().describe("Optional: ui_visibility, important_fields, required_fields"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ field_code, include_fields }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `${basePath}/${field_code}`, compactBody({ include_fields }));
        return ok(serialize(data.data));
      } catch (e) { return err(e); }
    });

    // ── CREATE ──────────────────────────────────────────────────────────────
    server.registerTool(`pipedrive_create_${entity}`, {
      title: `Create ${entityLabel}`,
      description: `Create a new custom ${entityLabel.toLowerCase()} (v2 API). Required: field_name, field_type.

field_type determines the data type. Common types:
  varchar (text ≤255), text (≤65k), double (number), monetary (amount+currency),
  date, daterange, time, timerange, enum (single-select), set (multi-select),
  phone, address, user, org, people, varchar_auto (autocomplete text).

For enum/set types: provide initial options as array of { label } objects.
Options can also be managed later via add/update/delete options tools.

ui_visibility controls display in Pipedrive web UI (add modal, detail view).
important_fields highlights field at specific pipeline stages.
required_fields makes field mandatory at specific stages.`,
      inputSchema: z.object({
        field_name: z.string().min(1).describe("Display name for the field (required)"),
        field_type: z.enum(FIELD_TYPES).describe("Data type of the field (required, cannot be changed after creation)"),
        description: z.string().optional().describe("Field description"),
        options: z.array(OptionSchema).optional().describe("Initial options (required for enum/set types). Array of { label, color? }"),
        ui_visibility: UiVisibilitySchema,
        important_fields: ImportantFieldsSchema,
        required_fields: RequiredFieldsSchema,
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (params) => {
      try {
        const data = await client.post<SingleResponse<unknown>>(basePath, compactBody(params as Record<string, unknown>));
        return ok(`${entityLabel} created.\n\n${serialize(data.data)}`);
      } catch (e) { return err(e); }
    });

    // ── UPDATE ──────────────────────────────────────────────────────────────
    server.registerTool(`pipedrive_update_${entity}`, {
      title: `Update ${entityLabel}`,
      description: `Update a custom ${entityLabel.toLowerCase()} via PATCH (v2 API).

Only custom fields (is_custom_field=true) can be updated. System fields are read-only.
field_code and field_type CANNOT be changed. At least one field must be provided.

To manage options (enum/set), use the separate add/update/delete options tools.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code to update (40-char hash)"),
        field_name: z.string().min(1).optional().describe("New display name"),
        description: z.string().optional().describe("New description"),
        ui_visibility: UiVisibilitySchema,
        important_fields: ImportantFieldsSchema,
        required_fields: RequiredFieldsSchema,
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ field_code, ...fields }) => {
      try {
        const data = await client.patch<SingleResponse<unknown>>(
          `${basePath}/${field_code}`, compactBody(fields as Record<string, unknown>));
        return ok(`${entityLabel} '${field_code}' updated.\n\n${serialize(data.data)}`);
      } catch (e) { return err(e); }
    });

    // ── DELETE ──────────────────────────────────────────────────────────────
    server.registerTool(`pipedrive_delete_${entity}`, {
      title: `Delete ${entityLabel}`,
      description: `Delete a custom ${entityLabel.toLowerCase()} (v2 API). Permanent deletion.

Only custom fields (is_custom_field=true) can be deleted. System fields cannot be deleted.
WARNING: This also removes all data stored in this field across ALL entities. Irreversible.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code to delete (40-char hash)"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, async ({ field_code }) => {
      try {
        await client.del(`${basePath}/${field_code}`);
        return ok(`${entityLabel} '${field_code}' permanently deleted.`);
      } catch (e) { return err(e); }
    });

    // ── ADD OPTIONS (bulk) ──────────────────────────────────────────────────
    server.registerTool(`pipedrive_add_${entity}_options`, {
      title: `Add ${entityLabel} Options`,
      description: `Add new options to an enum or set ${entityLabel.toLowerCase()} (v2 API).

Atomic operation — all options are added or none. Returns only the newly added options.
Only works on fields with field_type=enum or field_type=set.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code (must be an enum or set field)"),
        options: z.array(OptionSchema).min(1).describe("Array of options to add. Each must have a label."),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ field_code, options }) => {
      try {
        const data = await client.post<{ success: boolean; data: unknown[] }>(
          `${basePath}/${field_code}/options`, options);
        return ok(`${options.length} option(s) added.\n\n${serialize(data.data)}`);
      } catch (e) { return err(e); }
    });

    // ── UPDATE OPTIONS (bulk) ───────────────────────────────────────────────
    server.registerTool(`pipedrive_update_${entity}_options`, {
      title: `Update ${entityLabel} Options`,
      description: `Update existing options of an enum or set ${entityLabel.toLowerCase()} (v2 API).

Each option object must include id (integer) and the new label.
Use list fields or get field to find current option IDs.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code (must be an enum or set field)"),
        options: z.array(OptionUpdateSchema).min(1).describe("Array of { id, label } objects"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ field_code, options }) => {
      try {
        const data = await client.patch<{ success: boolean; data: unknown[] }>(
          `${basePath}/${field_code}/options`, options);
        return ok(`${options.length} option(s) updated.\n\n${serialize(data.data)}`);
      } catch (e) { return err(e); }
    });

    // ── DELETE OPTIONS (bulk) ───────────────────────────────────────────────
    server.registerTool(`pipedrive_delete_${entity}_options`, {
      title: `Delete ${entityLabel} Options`,
      description: `Delete options from an enum or set ${entityLabel.toLowerCase()} (v2 API).

Provide option IDs to delete. Atomic operation.
WARNING: Entities using deleted options will have those values cleared.`,
      inputSchema: z.object({
        field_code: z.string().min(1).describe("Field code (must be an enum or set field)"),
        option_ids: z.array(z.number().int().positive()).min(1).describe("Array of option IDs to delete"),
      }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, async ({ field_code, option_ids }) => {
      try {
        // DELETE with body — pass IDs as array
        await client.del(`${basePath}/${field_code}/options`, { ids: option_ids.join(",") });
        return ok(`${option_ids.length} option(s) deleted from field '${field_code}'.`);
      } catch (e) { return err(e); }
    });

  } // end for each entity

  // ── ACTIVITY FIELD: GET ONE (read-only, no CRUD) ────────────────────────
  server.registerTool("pipedrive_get_activity_field", {
    title: "Get Activity Field",
    description: `Get metadata for a single activity field by field_code (v2 API).

Activity fields are system-managed and cannot be created/updated/deleted via API.
Use this to inspect a specific field's type, options (for priority), and subfields.

include_fields: ui_visibility.`,
    inputSchema: z.object({
      field_code: z.string().min(1).describe("Field code (e.g. 'subject', 'type', 'priority', or custom hash)"),
      include_fields: z.string().optional().describe("Optional: ui_visibility"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ field_code, include_fields }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(
        `/api/v2/activityFields/${field_code}`, compactBody({ include_fields }));
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  // ── ACTIVITY TYPES: GET ONE, POST, DELETE ───────────────────────────────
  server.registerTool("pipedrive_get_activity_type", {
    title: "Get Activity Type",
    description: `Get details of a specific activity type by ID (v1 API).

Returns: id, name, key_string, icon_key, color, order_nr, is_custom_flag, active_flag.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Activity type ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v1/activityTypes/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_activity_type", {
    title: "Create Activity Type",
    description: `Create a custom activity type (v1 API). Required: name, icon_key.

The key_string is auto-generated from the name and CANNOT be changed.
Common icon_key values: task, email, meeting, call, lunch, calendar, deadline, default.

color: HEX code without # (e.g. 'ff0000' for red). Default varies.`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Activity type name (required). key_string auto-generated from this."),
      icon_key: z.string().min(1).describe("Icon key (required). Values: task, email, meeting, call, lunch, calendar, deadline, default."),
      color: z.string().optional().describe("HEX color without # (e.g. 'ff0000')"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v1/activityTypes", compactBody(params as Record<string, unknown>));
      return ok(`Activity type created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_activity_type", {
    title: "Update Activity Type",
    description: `Update a custom activity type (v1 API — uses PUT).

Only include fields to change. Built-in types can have their order_nr changed but not their name.

Args:
  - id (number): Activity type ID (required)
  - name (string): New name (custom types only)
  - icon_key (string): Icon key: task, email, meeting, call, lunch, calendar, deadline, default
  - color (string): HEX color without # (e.g. 'ff0000')
  - order_nr (number): Order number for sorting in the UI`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Activity type ID"),
      name: z.string().min(1).optional().describe("New name"),
      icon_key: z.string().min(1).optional().describe("Icon key"),
      color: z.string().optional().describe("HEX color without #"),
      order_nr: z.number().int().min(0).optional().describe("Sort order in UI"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.put<SingleResponse<unknown>>(`/api/v1/activityTypes/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Activity type ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_activity_type", {
    title: "Delete Activity Type",
    description: `Delete a custom activity type (v1 API). Only custom types (is_custom_flag=true) can be deleted.

Built-in types (call, meeting, task, etc.) cannot be deleted.
Existing activities of this type will retain their type value but the type becomes invalid for new activities.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Activity type ID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v1/activityTypes/${id}`);
      return ok(`Activity type ${id} deleted.`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_activity_types_bulk", {
    title: "Delete Multiple Activity Types",
    description: `Delete multiple custom activity types at once (v1 API).

Provide a comma-separated list of activity type IDs. Only custom types can be deleted.

Args:
  - ids (string): Comma-separated activity type IDs (required, e.g. "10,11,12")`,
    inputSchema: z.object({
      ids: z.string().min(1).describe("Comma-separated activity type IDs (required)"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ ids }) => {
    try {
      await client.del("/api/v1/activityTypes", { ids });
      return ok(`Activity types deleted: ${ids}`);
    } catch (e) { return err(e); }
  });

}
