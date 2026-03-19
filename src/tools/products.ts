// src/tools/products.ts — Pipedrive Products API v2
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PipedriveClient, ListResponseV2, ListResponseV1, SingleResponse } from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

const PriceSchema = z.object({
  price: z.number().nonnegative().describe("Price amount"),
  currency: z.string().length(3).describe("3-letter currency code (use pipedrive_list_currencies)"),
  cost: z.number().nonnegative().optional().describe("Cost price"),
  direct_cost: z.number().nonnegative().optional().describe("Direct cost"),
});

export function registerProductTools(server: McpServer, client: PipedriveClient): void {

  server.registerTool("pipedrive_list_products", {
    title: "List Products",
    description: `List products with cursor pagination (v2).

Filters: filter_id, ids, owner_id.
  - filter_id: saved Pipedrive filter ID
  - ids: comma-separated list of up to 100 product IDs
sort_by: id | name | add_time | update_time (v2 supports all 4).
custom_fields: comma-separated keys to include (max 15, reduces payload).

v2: is_deleted (was active_flag, negated), is_linkable (was selectable),
owner_id is plain integer, product_variations moved to separate API.`,
    inputSchema: z.object({
      filter_id: z.number().int().positive().optional().describe("Saved Pipedrive filter ID"),
      ids: z.string().optional().describe("Comma-separated product IDs (up to 100)"),
      owner_id: z.number().int().positive().optional(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
      sort_by: z.enum(["id","name","add_time","update_time"]).default("id"),
      sort_direction: z.enum(["asc","desc"]).default("asc"),
      custom_fields: z.string().optional().describe("Comma-separated custom field keys (max 15)"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>("/api/v2/products", compactBody(params as Record<string, unknown>));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data.length} product(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_get_product", {
    title: "Get Product",
    description: `Get a single product by ID (v2).`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Product ID"),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.get<SingleResponse<unknown>>(`/api/v2/products/${id}`);
      return ok(serialize(data.data));
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_product", {
    title: "Create Product",
    description: `Create a product (v2). Required: name.

prices: array of price objects (one per currency). Default if omitted: price=0 in user's default currency.
visible_to: 1=Owner/followers, 3=Company (on Growth plans), or 1/3/5/7 on Premium/Ultimate.
is_linkable: if true (default), product can be attached to deals.
category: integer (not string).
billing_frequency: requires Growth+ plan.
  Values: one-time | annually | semi-annually | quarterly | monthly | weekly.
billing_frequency_cycles: null for indefinite; must be null if frequency=one-time.`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Product name (required)"),
      code: z.string().optional().describe("SKU / product code"),
      description: z.string().optional(),
      unit: z.string().optional().describe("Unit of measurement (e.g. pcs, hours, months)"),
      tax: z.number().min(0).max(100).optional().describe("Tax percentage (default: 0)"),
      category: z.number().int().optional().describe("Category ID (integer, not string)"),
      owner_id: z.number().int().positive().optional(),
      is_linkable: z.boolean().optional().describe("Can be linked to deals (default: true)"),
      visible_to: z.number().int().optional().describe("Visibility: 1, 3, 5, or 7"),
      prices: z.array(PriceSchema).optional().describe("Price list (one entry per currency)"),
      billing_frequency: z.enum(["one-time","annually","semi-annually","quarterly","monthly","weekly"]).optional().describe("Subscription billing frequency (Growth+ plans only)"),
      billing_frequency_cycles: z.number().int().min(1).max(208).nullable().optional().describe("Number of billing cycles (null=indefinite; must be null for one-time)"),
      custom_fields: z.record(z.unknown()).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.post<SingleResponse<unknown>>("/api/v2/products", compactBody(params as Record<string, unknown>));
      return ok(`Product created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_product", {
    title: "Update Product",
    description: `Update a product via PATCH (v2). Only include fields to change.

WARNING: prices array is FULLY REPLACED when sent. Include all currencies to keep.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Product ID to update"),
      name: z.string().min(1).optional(),
      code: z.string().optional(),
      description: z.string().optional(),
      unit: z.string().optional(),
      tax: z.number().min(0).max(100).optional(),
      category: z.number().int().optional().describe("Category ID (integer)"),
      owner_id: z.number().int().positive().optional(),
      is_linkable: z.boolean().optional(),
      visible_to: z.number().int().optional(),
      prices: z.array(PriceSchema).optional().describe("Replaces ALL existing prices"),
      billing_frequency: z.enum(["one-time","annually","semi-annually","quarterly","monthly","weekly"]).optional(),
      billing_frequency_cycles: z.number().int().min(1).max(208).nullable().optional(),
      custom_fields: z.record(z.unknown()).optional(),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ id, ...fields }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v2/products/${id}`, compactBody(fields as Record<string, unknown>));
      return ok(`Product ${id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_product", {
    title: "Delete Product",
    description: `Soft-delete a product (v2). Permanently removed after 30 days.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Product ID"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ id }) => {
    try {
      await client.del(`/api/v2/products/${id}`);
      return ok(`Product ${id} deleted (soft).`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_search_products", {
    title: "Search Products",
    description: `Search products by name, code, or custom fields (v2).

Searchable fields: name | code | custom_fields (comma-separated, default: all).
include_fields: product.price (include price data in results).`,
    inputSchema: z.object({
      term: z.string().min(1).describe("Search term (min 2 chars unless exact_match=true)"),
      fields: z.string().optional().describe("Fields: name, code, custom_fields"),
      exact_match: z.boolean().optional(),
      include_fields: z.string().optional().describe("Optional: product.price"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (params) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>("/api/v2/products/search", compactBody(params as Record<string, unknown>));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data.length} product(s) for "${params.term}".${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_duplicate_product", {
    title: "Duplicate Product",
    description: `Create a duplicate of a product (v2). Copies all variations, prices, and custom fields.`,
    inputSchema: z.object({
      id: z.number().int().positive().describe("Product ID to duplicate"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ id }) => {
    try {
      const data = await client.post<SingleResponse<unknown>>(`/api/v2/products/${id}/duplicate`, {});
      return ok(`Product ${id} duplicated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_list_product_variations", {
    title: "List Product Variations",
    description: `List all variations of a product (v2 API). Each variation has its own prices per currency.

Returns: id, name, product_id, prices (array with currency, price, cost, direct_cost).`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, cursor, limit }) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>(`/api/v2/products/${product_id}/variations`, compactBody({ cursor, limit }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data.length} variation(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_create_product_variation", {
    title: "Create Product Variation",
    description: `Create a new variation for a product (v2 API). Required: name.

Each variation can have its own prices per currency.
When prices are omitted, defaults to price=0, cost=0, direct_cost=0 in user's default currency.`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      name: z.string().min(1).max(255).describe("Variation name (max 255 chars, required)"),
      prices: z.array(z.object({
        price: z.number().nonnegative().describe("Price amount"),
        currency: z.string().length(3).describe("3-letter currency code"),
        cost: z.number().nonnegative().optional(),
        direct_cost: z.number().nonnegative().optional(),
      }).strict()).optional().describe("Price list per currency"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ product_id, ...body }) => {
    try {
      const data = await client.post<SingleResponse<unknown>>(`/api/v2/products/${product_id}/variations`, compactBody(body as Record<string, unknown>));
      return ok(`Variation created.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_update_product_variation", {
    title: "Update Product Variation",
    description: `Update a product variation via PATCH (v2 API). Only include fields to change.

WARNING: prices array is FULLY REPLACED when sent. Include all currencies to keep.`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      variation_id: z.number().int().positive().describe("Variation ID"),
      name: z.string().min(1).max(255).optional().describe("Variation name"),
      prices: z.array(z.object({
        price: z.number().nonnegative().describe("Price amount"),
        currency: z.string().length(3).describe("3-letter currency code"),
        cost: z.number().nonnegative().optional(),
        direct_cost: z.number().nonnegative().optional(),
      }).strict()).optional().describe("Replaces ALL existing variation prices"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, variation_id, ...body }) => {
    try {
      const data = await client.patch<SingleResponse<unknown>>(`/api/v2/products/${product_id}/variations/${variation_id}`, compactBody(body as Record<string, unknown>));
      return ok(`Variation ${variation_id} updated.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_product_variation", {
    title: "Delete Product Variation",
    description: `Delete a product variation (v2 API). Permanent deletion.`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      variation_id: z.number().int().positive().describe("Variation ID to delete"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, variation_id }) => {
    try {
      await client.del(`/api/v2/products/${product_id}/variations/${variation_id}`);
      return ok(`Variation ${variation_id} deleted from product ${product_id}.`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_list_product_deals", {
    title: "List Product Deals",
    description: `Get all deals that have a specific product attached (v1 API).

Returns deals with the product attached as a line item.
status: open | won | lost | deleted | all_not_deleted (default: all_not_deleted).`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      status: z.enum(["open","won","lost","deleted","all_not_deleted"]).default("all_not_deleted").describe("Filter by deal status"),
      start: z.number().int().min(0).default(0).describe("Pagination offset (v1)"),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, status, start, limit }) => {
    try {
      const data = await client.get<ListResponseV1<unknown>>(`/api/v1/products/${product_id}/deals`, compactBody({ status, start, limit }));
      const pg = data.additional_data?.pagination;
      return ok(`${data.data?.length ?? 0} deal(s) with product ${product_id}.${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_list_product_followers", {
    title: "List Product Followers",
    description: `List users following a product (v2 API). Returns: user_id, add_time.`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, cursor, limit }) => {
    try {
      const data = await client.get<ListResponseV2<unknown>>(`/api/v2/products/${product_id}/followers`, compactBody({ cursor, limit }));
      const nc = data.additional_data?.next_cursor;
      return ok(`${data.data.length} follower(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_add_product_follower", {
    title: "Add Product Follower",
    description: `Add a user as a follower of a product (v2 API). Returns 400 if already following.`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      user_id: z.number().int().positive().describe("User ID to add as follower"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ product_id, user_id }) => {
    try {
      const data = await client.post<SingleResponse<unknown>>(`/api/v2/products/${product_id}/followers`, { user_id });
      return ok(`User ${user_id} added as follower to product ${product_id}.\n\n${serialize(data.data)}`);
    } catch (e) { return err(e); }
  });

  server.registerTool("pipedrive_delete_product_follower", {
    title: "Delete Product Follower",
    description: `Remove a user from a product's followers (v2 API). Use user_id (not follower object ID).`,
    inputSchema: z.object({
      product_id: z.number().int().positive().describe("Product ID"),
      user_id: z.number().int().positive().describe("User ID to remove as follower"),
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ product_id, user_id }) => {
    try {
      await client.del(`/api/v2/products/${product_id}/followers/${user_id}`);
      return ok(`User ${user_id} removed as follower from product ${product_id}.`);
    } catch (e) { return err(e); }
  });
}
