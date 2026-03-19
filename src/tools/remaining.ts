// src/tools/remaining.ts — Pipedrive remaining sub-resources (v1.5.0)
// All endpoints needed to reach 100% in-scope coverage.
// Organized by entity: Deals, Persons, Products, Leads, Files, Filters, Users.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  PipedriveClient,
  ListResponseV1,
  SingleResponse,
} from "../client.ts";
import { ok, err, compactBody, serialize } from "../client.ts";

export function registerRemainingTools(
  server: McpServer,
  client: PipedriveClient,
): void {
  // ═══════════════════════════════════════════════════════════════════════════
  // DEALS — follower changelog, participants changelog, bulk products
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_list_deal_follower_changelog",
    {
      title: "List Deal Follower Changelog",
      description: `List changelog of follower additions/removals for a deal (v2 API, cursor-paginated).

Returns chronological events: user_id, action (added/removed), time.
Useful for auditing who followed/unfollowed a deal and when.

Args:
  - deal_id (number): Deal ID (required)
  - cursor (string): Pagination cursor from previous response
  - limit (number): Results per page (default 50, max 500)`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          cursor: z.string().optional().describe("Pagination cursor"),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, cursor, limit }) => {
      try {
        const data = await client.get<{
          success: boolean;
          data: unknown[];
          additional_data?: { next_cursor?: string };
        }>(
          `/api/v2/deals/${deal_id}/followers/changelog`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data?.length ?? 0} follower change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_list_deal_participants_changelog",
    {
      title: "List Deal Participants Changelog",
      description: `List changelog of participant additions/removals for a deal (v2 API, cursor-paginated).

Returns events about persons being added to or removed from a deal as participants.

Args:
  - deal_id (number): Deal ID (required)
  - cursor (string): Pagination cursor
  - limit (number): Results per page (default 50, max 500)`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, cursor, limit }) => {
      try {
        const data = await client.get<{
          success: boolean;
          data: unknown[];
          additional_data?: { next_cursor?: string };
        }>(
          `/api/v2/deals/${deal_id}/participants/changelog`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data?.length ?? 0} participant change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_add_many_deal_products",
    {
      title: "Add Multiple Products to Deal",
      description: `Add up to 100 products to a deal in a single request (v2 bulk API, released Oct 2025).

More efficient than calling pipedrive_add_product_to_deal in a loop.
Each product in the array requires: product_id, item_price, quantity.

Args:
  - deal_id (number): Deal ID (required)
  - products (array): Array of product objects, each with product_id, item_price, quantity, and optional tax, comments, discount, discount_type, is_enabled.

Returns:
  Array of created deal-product attachments.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          products: z
            .array(
              z
                .object({
                  product_id: z
                    .number()
                    .int()
                    .positive()
                    .describe("Product ID"),
                  item_price: z.number().nonnegative().describe("Unit price"),
                  quantity: z.number().positive().describe("Quantity"),
                  tax: z
                    .number()
                    .min(0)
                    .max(100)
                    .optional()
                    .describe("Tax percentage"),
                  comments: z.string().optional(),
                  discount: z.number().nonnegative().optional(),
                  discount_type: z.enum(["percentage", "amount"]).optional(),
                  is_enabled: z.boolean().optional(),
                })
                .strict(),
            )
            .min(1)
            .max(100)
            .describe("Array of products (1-100)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ deal_id, products }) => {
      try {
        const data = await client.post<{ success: boolean; data: unknown[] }>(
          `/api/v2/deals/${deal_id}/products/bulk`,
          products,
        );
        return ok(
          `${data.data?.length ?? 0} product(s) added to deal ${deal_id}.\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_many_deal_products",
    {
      title: "Delete Multiple Products from Deal",
      description: `Remove multiple products from a deal in a single request (v2 bulk API, released Oct 2025).

If product_attachment_ids is omitted, up to 100 products will be removed.

Args:
  - deal_id (number): Deal ID (required)
  - product_attachment_ids (string): Optional comma-separated deal-product IDs. If omitted, removes all (up to 100).

Returns:
  Confirmation of deleted products.`,
      inputSchema: z
        .object({
          deal_id: z.number().int().positive().describe("Deal ID"),
          product_attachment_ids: z
            .string()
            .optional()
            .describe(
              "Comma-separated deal-product IDs. Omit to delete all (up to 100).",
            ),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ deal_id, product_attachment_ids }) => {
      try {
        await client.del(
          `/api/v2/deals/${deal_id}/products`,
          compactBody({ ids: product_attachment_ids }),
        );
        return ok(`Products removed from deal ${deal_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONS — picture get/delete
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_get_person_picture",
    {
      title: "Get Person Picture",
      description: `Get the profile picture of a person (v1 API).

Returns picture metadata with download URLs in multiple sizes: 128x128, 512x512, original.
URLs are signed and expire — use them promptly.
Returns null/empty if the person has no picture.

Args:
  - person_id (number): Person ID (required)`,
      inputSchema: z
        .object({
          person_id: z.number().int().positive().describe("Person ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ person_id }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v1/persons/${person_id}/picture`,
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_person_picture",
    {
      title: "Delete Person Picture",
      description: `Delete the profile picture of a person (v1 API). Permanent deletion.

Args:
  - person_id (number): Person ID (required)`,
      inputSchema: z
        .object({
          person_id: z.number().int().positive().describe("Person ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ person_id }) => {
      try {
        await client.del(`/api/v1/persons/${person_id}/picture`);
        return ok(`Picture deleted from person ${person_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS — files, follower changelog, image get/delete, permitted users
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_list_product_files",
    {
      title: "List Product Files",
      description: `List files attached to a product (v1 API).

Returns: id, name, file_type, file_size, url (signed download link), add_time.

Args:
  - product_id (number): Product ID (required)
  - start (number): Pagination offset (default 0)
  - limit (number): Results per page (default 50, max 100)`,
      inputSchema: z
        .object({
          product_id: z.number().int().positive().describe("Product ID"),
          start: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id, start, limit }) => {
      try {
        const data = await client.get<ListResponseV1<unknown>>(
          `/api/v1/products/${product_id}/files`,
          compactBody({ start, limit }),
        );
        const pg = data.additional_data?.pagination;
        return ok(
          `${data.data?.length ?? 0} file(s).${pg?.more_items_in_collection ? ` More (next_start: ${pg.next_start})` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_list_product_follower_changelog",
    {
      title: "List Product Follower Changelog",
      description: `List changelog of follower additions/removals for a product (v2 API, cursor-paginated).

Args:
  - product_id (number): Product ID (required)
  - cursor (string): Pagination cursor
  - limit (number): Results per page (default 50, max 500)`,
      inputSchema: z
        .object({
          product_id: z.number().int().positive().describe("Product ID"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id, cursor, limit }) => {
      try {
        const data = await client.get<{
          success: boolean;
          data: unknown[];
          additional_data?: { next_cursor?: string };
        }>(
          `/api/v2/products/${product_id}/followers/changelog`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data?.length ?? 0} follower change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_get_product_image",
    {
      title: "Get Product Image",
      description: `Get the image of a product (v2 API).

Returns a public URL with a limited lifetime of 7 days.
Use the URL promptly for display or download.
Returns empty/null if no image is set.

Args:
  - product_id (number): Product ID (required)`,
      inputSchema: z
        .object({
          product_id: z.number().int().positive().describe("Product ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id }) => {
      try {
        const data = await client.get<SingleResponse<unknown>>(
          `/api/v2/products/${product_id}/image`,
        );
        return ok(serialize(data.data));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_delete_product_image",
    {
      title: "Delete Product Image",
      description: `Delete the image of a product (v2 API). Permanent deletion.

Args:
  - product_id (number): Product ID (required)`,
      inputSchema: z
        .object({
          product_id: z.number().int().positive().describe("Product ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id }) => {
      try {
        await client.del(`/api/v2/products/${product_id}/image`);
        return ok(`Image deleted from product ${product_id}.`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_list_product_permitted_users",
    {
      title: "List Product Permitted Users",
      description: `List users who have access to a specific product (v1 API).

Returns user objects with access level.

Args:
  - product_id (number): Product ID (required)`,
      inputSchema: z
        .object({
          product_id: z.number().int().positive().describe("Product ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id }) => {
      try {
        const data = await client.get<{ success: boolean; data: unknown[] }>(
          `/api/v1/products/${product_id}/permittedUsers`,
        );
        return ok(
          `${data.data?.length ?? 0} permitted user(s).\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADS — permitted users
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_list_lead_permitted_users",
    {
      title: "List Lead Permitted Users",
      description: `List users who have access to a specific lead (v1 API).

Lead IDs are UUIDs (not integers).

Args:
  - lead_id (string): Lead UUID (required)`,
      inputSchema: z
        .object({
          lead_id: z.string().uuid().describe("Lead UUID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ lead_id }) => {
      try {
        const data = await client.get<{ success: boolean; data: unknown[] }>(
          `/api/v1/leads/${lead_id}/permittedUsers`,
        );
        return ok(
          `${data.data?.length ?? 0} permitted user(s).\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FILES — remote link, remote create, update metadata
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_create_remote_file",
    {
      title: "Create Remote File",
      description: `Create a new empty file in a remote location (Google Drive) and link it to a Pipedrive item (v1 API).

The user must have an activated Google Account in Pipedrive.

Args:
  - file_type (string): Remote file type: gdoc, gslides, gsheet, gdraw, gform (required)
  - title (string): File title (required)
  - item_type (string): Entity type: deal, person, organization, lead, activity, product, note (required)
  - item_id (number|string): Entity ID — integer for most, UUID string for leads (required)
  - remote_location (string): Currently only "googledrive" (required)

Returns:
  File object with id, name, url, remote_id.`,
      inputSchema: z
        .object({
          file_type: z
            .enum(["gdoc", "gslides", "gsheet", "gdraw", "gform"])
            .describe("Remote file type (required)"),
          title: z.string().min(1).describe("File title (required)"),
          item_type: z
            .enum([
              "deal",
              "person",
              "organization",
              "lead",
              "activity",
              "product",
              "note",
            ])
            .describe("Entity type to link to (required)"),
          item_id: z
            .union([z.number().int().positive(), z.string()])
            .describe("Entity ID (integer or UUID for leads)"),
          remote_location: z
            .string()
            .default("googledrive")
            .describe("Remote location (currently only 'googledrive')"),
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
          "/api/v1/files/remote",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Remote file created.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_link_remote_file",
    {
      title: "Link Existing Remote File",
      description: `Link an existing remote file (from Google Drive) to a Pipedrive item (v1 API).

Unlike create_remote_file, this links an ALREADY EXISTING file by its remote_id.
The user must have an activated Google Account in Pipedrive.

Args:
  - item_type (string): deal, person, organization (required)
  - item_id (number): Entity ID (required)
  - remote_id (string): Remote file identifier from Google Drive (required)
  - remote_location (string): "googledrive" (required)

Returns:
  File object with id, name, url.`,
      inputSchema: z
        .object({
          item_type: z
            .enum(["deal", "person", "organization"])
            .describe("Entity type (required)"),
          item_id: z.number().int().positive().describe("Entity ID (required)"),
          remote_id: z
            .string()
            .min(1)
            .describe("Remote file ID from Google Drive (required)"),
          remote_location: z
            .string()
            .default("googledrive")
            .describe("Remote location ('googledrive')"),
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
          "/api/v1/files/remoteLink",
          compactBody(params as Record<string, unknown>),
        );
        return ok(`Remote file linked.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    "pipedrive_update_file",
    {
      title: "Update File",
      description: `Update a file's metadata (v1 API — uses PUT).

Can change: name, description. Cannot change the file content itself.

Args:
  - id (number): File ID (required)
  - name (string): New file name
  - description (string): New description`,
      inputSchema: z
        .object({
          id: z.number().int().positive().describe("File ID"),
          name: z.string().min(1).optional().describe("New file name"),
          description: z.string().optional().describe("New file description"),
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
        const data = await client.put<SingleResponse<unknown>>(
          `/api/v1/files/${id}`,
          compactBody(fields as Record<string, unknown>),
        );
        return ok(`File ${id} updated.\n\n${serialize(data.data)}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTERS — bulk delete
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_delete_filters_bulk",
    {
      title: "Delete Multiple Filters",
      description: `Delete multiple filters at once (v1 API).

Provide a comma-separated list of filter IDs.

Args:
  - ids (string): Comma-separated filter IDs (required, e.g. "1,2,3")`,
      inputSchema: z
        .object({
          ids: z
            .string()
            .min(1)
            .describe("Comma-separated filter IDs (required)"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ ids }) => {
      try {
        await client.del("/api/v1/filters", { ids });
        return ok(`Filters deleted: ${ids}`);
      } catch (e) {
        return err(e);
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS — follower changelog
  // ═══════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "pipedrive_list_user_follower_changelog",
    {
      title: "List User Follower Changelog",
      description: `List changelog of follower additions/removals for a user (v2 API, cursor-paginated).

Args:
  - user_id (number): User ID (required)
  - cursor (string): Pagination cursor
  - limit (number): Results per page (default 50, max 500)`,
      inputSchema: z
        .object({
          user_id: z.number().int().positive().describe("User ID"),
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(500).default(50),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ user_id, cursor, limit }) => {
      try {
        const data = await client.get<{
          success: boolean;
          data: unknown[];
          additional_data?: { next_cursor?: string };
        }>(
          `/api/v2/users/${user_id}/followers/changelog`,
          compactBody({ cursor, limit }),
        );
        const nc = data.additional_data?.next_cursor;
        return ok(
          `${data.data?.length ?? 0} follower change(s).${nc ? ` Next cursor: ${nc}` : ""}\n\n${serialize(data.data)}`,
        );
      } catch (e) {
        return err(e);
      }
    },
  );
}
