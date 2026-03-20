# pipedrive-mcp-server v1.5.0

Production-ready Deno MCP (Model Context Protocol) server for the Pipedrive CRM API.

**203 tools** covering **22 API entities** — complete CRUD, search, analytics, field management, follower changelogs, bulk operations, and file management.

## Features

- **API v2** for all modern endpoints — cursor pagination, RFC 3339 timestamps, nested `custom_fields`, `PATCH`, `Authorization: Bearer` header
- **API v1** only where no v2 equivalent exists (Notes, Leads CRUD, Users, Filters, Files, ActivityTypes, Currencies, LeadLabels, LeadSources)
- **Deno** — no build step, TypeScript-native, minimal permissions (`--allow-net --allow-env` only)
- All breaking changes up to **March 2026** handled (archived deals/leads, deprecated v1 endpoints, Channels API deprecation, Fields API v2, bulk product ops, etc.)
- **203 tools** — the most comprehensive open-source Pipedrive MCP server available

---

## Prerequisites

- [Deno](https://deno.land/) v1.40+
- A Pipedrive account with API access

---

## Quick Setup

### 1. Get your credentials

| Variable              | Where                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `PIPEDRIVE_API_TOKEN` | Pipedrive → Settings → Personal preferences → API                 |
| `PIPEDRIVE_DOMAIN`    | From your URL: `https://DOMAIN.pipedrive.com` — use `DOMAIN` only |

### 2. Configure Claude Code

Add to `~/.claude.json` under `"mcpServers"`:

```json
"pipedrive": {
  "command": "deno",
  "args": [
    "run",
    "--allow-net",
    "--allow-env=PIPEDRIVE_API_TOKEN,PIPEDRIVE_DOMAIN",
    "/absolute/path/to/pipedrive-mcp-server/src/index.ts"
  ],
  "env": {
    "PIPEDRIVE_API_TOKEN": "your_api_token_here",
    "PIPEDRIVE_DOMAIN": "yourcompany"
  }
}
```

### 3. Verify

```bash
PIPEDRIVE_API_TOKEN=xxx PIPEDRIVE_DOMAIN=yourcompany \
  deno run --allow-net --allow-env=PIPEDRIVE_API_TOKEN,PIPEDRIVE_DOMAIN \
  src/index.ts
# → [pipedrive-mcp] v1.5.0 ready — https://yourcompany.pipedrive.com
# → [pipedrive-mcp] 203 tools across 22 API entities
```

---

## Tools (203 total)

### Deals — 22 tools (v2)

`list_deals` · `list_archived_deals` · `get_deal` · `create_deal` · `update_deal` · `delete_deal` · `search_deals` · `duplicate_deal` · `merge_deals` · `list_deal_products` · `get_deals_products` · `add_product_to_deal` · `update_deal_product` · `delete_deal_product` · `list_deal_participants` · `add_deal_participant` · `delete_deal_participant` · `list_deal_followers` · `add_deal_follower` · `delete_deal_follower` · `convert_deal_to_lead` · `get_deal_conversion_status`

### Deals Extended — 17 tools (v2 + v1)

`get_deals_summary` · `get_archived_deals_summary` · `get_deals_timeline` · `get_archived_deals_timeline` · `list_deal_discounts` · `add_deal_discount` · `update_deal_discount` · `delete_deal_discount` · `list_deal_installments` · `add_deal_installment` · `update_deal_installment` · `delete_deal_installment` · `list_deal_changelog` · `list_deal_files` · `list_deal_updates` · `list_deal_mail_messages` · `list_deal_permitted_users`

### Persons — 10 tools (v2)

`list_persons` · `get_person` · `create_person` · `update_person` · `delete_person` · `search_persons` · `merge_persons` · `list_person_followers` · `add_person_follower` · `delete_person_follower`

### Persons Extended — 7 tools (v1 + v2)

`list_person_changelog` · `list_person_files` · `list_person_updates` · `list_person_follower_changelog` · `list_person_mail_messages` · `list_person_permitted_users` · `list_person_products`

### Organizations — 10 tools (v2)

`list_organizations` · `get_organization` · `create_organization` · `update_organization` · `delete_organization` · `search_organizations` · `merge_organizations` · `list_org_followers` · `add_org_follower` · `delete_org_follower`

### Organizations Extended — 6 tools (v1 + v2)

`list_organization_changelog` · `list_organization_files` · `list_organization_updates` · `list_organization_follower_changelog` · `list_organization_mail_messages` · `list_organization_permitted_users`

### Activities — 5 tools (v2)

`list_activities` · `get_activity` · `create_activity` · `update_activity` · `delete_activity`

### Pipelines — 5 tools + Stages — 5 tools (v2)

Pipelines: `list_pipelines` · `get_pipeline` · `create_pipeline` · `update_pipeline` · `delete_pipeline`
Stages: `list_stages` · `get_stage` · `create_stage` · `update_stage` · `delete_stage`

### Pipeline Analytics — 2 tools (v1)

`get_pipeline_conversion_stats` · `get_pipeline_movement_stats`

### Products — 15 tools (v2)

`list_products` · `get_product` · `create_product` · `update_product` · `delete_product` · `search_products` · `duplicate_product` · `list_product_variations` · `create_product_variation` · `update_product_variation` · `delete_product_variation` · `list_product_deals` · `list_product_followers` · `add_product_follower` · `delete_product_follower`

### Leads — 9 tools (v1 + v2)

`list_leads` · `list_archived_leads` · `get_lead` · `create_lead` · `update_lead` · `delete_lead` · `search_leads` · `convert_lead_to_deal` · `get_lead_conversion_status`

### Lead Labels — 4 tools (v1)

`get_lead_label` · `create_lead_label` · `update_lead_label` · `delete_lead_label`

### Notes — 10 tools (v1)

`list_notes` · `get_note` · `create_note` · `update_note` · `delete_note` · `list_note_comments` · `get_note_comment` · `add_note_comment` · `update_note_comment` · `delete_note_comment`

### Filters — 6 tools (v1)

`list_filters` · `get_filter` · `create_filter` · `update_filter` · `delete_filter` · `get_filter_helpers`

> `get_filter_helpers` returns available conditions, operators, and field types for building filter rules.

### Files — 3 tools (v1)

`list_files` · `get_file` · `delete_file`

### Users — 4 tools (v1 + v2)

`get_current_user` · `list_users` · `search` (global) · `search_field`

### Users Extended — 3 tools (v1 + v2)

`get_user` · `get_user_permissions` · `list_user_followers`

### Fields CRUD — 34 tools (v2, Dec 2025)

Full custom field management for 4 entity types (Deal, Person, Organization, Product). Each gets 7 tools: `get` · `create` · `update` · `delete` · `add_options` · `update_options` · `delete_options`. Plus: `get_activity_field` · `get_activity_type` · `create_activity_type` · `update_activity_type` · `delete_activity_type` · `delete_activity_types_bulk`.

### Remaining — 17 tools (v1 + v2)

`list_deal_follower_changelog` · `list_deal_participants_changelog` · `add_many_deal_products` · `delete_many_deal_products` · `get_person_picture` · `delete_person_picture` · `list_product_files` · `list_product_follower_changelog` · `get_product_image` · `delete_product_image` · `list_product_permitted_users` · `list_lead_permitted_users` · `create_remote_file` · `link_remote_file` · `update_file` · `delete_filters_bulk` · `list_user_follower_changelog`

### Utilities — 9 tools (v1 + v2)

`list_activity_types` · `list_currencies` · `list_deal_fields` · `list_activity_fields` · `list_person_fields` · `list_organization_fields` · `list_product_fields` · `list_lead_labels` · `list_lead_sources`

---

## API v2 Key Differences from v1

| Feature            | v1                         | v2                                      |
| ------------------ | -------------------------- | --------------------------------------- |
| Pagination         | `start` + `limit` (offset) | `cursor` + `limit`                      |
| Timestamps         | `"2024-01-01 12:00:00"`    | `"2024-01-01T12:00:00Z"` (RFC 3339)     |
| Update method      | `PUT`                      | `PATCH`                                 |
| Custom fields      | Flat root-level hash keys  | Nested `custom_fields: { hash: value }` |
| Owner field        | `user_id`                  | `owner_id`                              |
| Deleted flag       | `active_flag: true`        | `is_deleted: false` (negated)           |
| Phone/email fields | `phone: []`                | `phones: []` (renamed)                  |
| Labels             | `label: "3,7"` (string)    | `label_ids: [3, 7]` (array)             |
| `visible_to`       | `"3"` (string)             | `3` (integer)                           |
| Token in request   | Query param `?api_token=`  | `x-api-token` header                    |

---

## Breaking Changes Handled

| Date         | Change                                   | How handled                                            |
| ------------ | ---------------------------------------- | ------------------------------------------------------ |
| Feb 1, 2026  | Channels API deprecated                  | Not implemented                                        |
| Dec 10, 2025 | Fields API v2 released                   | Full CRUD + options for 4 entity types                 |
| Nov 24, 2025 | Product Duplication API                  | `duplicate_product` tool                               |
| Nov 24, 2025 | `deal_id` filter for GET /api/v2/persons | Supported in `list_persons`                            |
| Oct 1, 2025  | Deal Products bulk operations            | `add_many_deal_products` + `delete_many_deal_products` |
| Aug 25, 2025 | Product Images API                       | `get_product_image` + `delete_product_image`           |
| Jul 15, 2025 | Archived leads not in `/v1/leads`        | `list_archived_leads` tool                             |
| Jul 15, 2025 | Archived deals not editable              | Documented in `update_deal` description                |
| Jan 1, 2026  | Deprecated v1 endpoints expired          | Already using v2 exclusively                           |

---

## Not Covered (4 operations)

File upload operations requiring `multipart/form-data` are not supported via MCP stdio transport:

| Operation                          | Reason                                  |
| ---------------------------------- | --------------------------------------- |
| `POST /api/v1/files`               | Binary file upload — requires multipart |
| `POST /api/v1/persons/:id/picture` | Image upload — requires multipart       |
| `POST /api/v2/products/:id/image`  | Image upload — requires multipart       |
| `PATCH /api/v2/products/:id/image` | Image update — requires multipart       |

All other operations across the 22 in-scope entities are fully covered.

---

## Rate Limits (Token-Based, since Dec 2024)

- **Daily budget**: `30,000 base tokens × plan multiplier × seats`
- **Burst**: rolling 2-second window
- **429** → back off using `Retry-After` header
- **403 (Cloudflare)** → IP blocked after sustained 429 abuse; wait several minutes
- Headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-Daily-RateLimit-Remaining`

---

## Security

Deno minimal permissions:

```
--allow-net          API calls to Pipedrive only
--allow-env=...      Two specific env vars only
```

No file system access, no subprocesses, no broad network. Domain is validated at startup (alphanumeric + hyphens only) to prevent injection attacks. API token sent as `Authorization: Bearer` header (not in URL query params).

---

## Architecture

```
src/
├── index.ts              # Entry point — env validation, server init, tool registration
├── client.ts             # API client — auth, timeout, rate limit handling, response helpers
└── tools/
    ├── deals.ts           # 22 tools — core CRUD + search + products + participants + followers
    ├── deals_extra.ts     # 17 tools — summary, timeline, discounts, installments, audit trail
    ├── persons.ts         # 10 tools — core CRUD + search + merge + followers
    ├── organizations.ts   # 10 tools — core CRUD + search + merge + followers
    ├── contacts_extra.ts  # 13 tools — DRY shared sub-resources for persons + organizations
    ├── activities.ts      #  5 tools — CRUD
    ├── pipelines.ts       # 10 tools — pipelines (5) + stages (5)
    ├── pipelines_extra.ts #  2 tools — conversion + movement analytics
    ├── products.ts        # 15 tools — CRUD + search + variations + deals + followers
    ├── leads.ts           #  9 tools — CRUD + search + convert + archived
    ├── lead_labels.ts     #  4 tools — lead label CRUD
    ├── notes.ts           # 10 tools — CRUD + comments CRUD
    ├── filters.ts         #  5 tools — saved filter CRUD
    ├── files.ts           #  3 tools — file list + get + delete
    ├── users.ts           #  4 tools — current user + list + global search + field search
    ├── users_extra.ts     #  3 tools — get user + permissions + followers
    ├── fields.ts          # 34 tools — DRY loop: 4 entities × 7 ops + activity field/type
    ├── remaining.ts       # 17 tools — follower changelogs, bulk ops, images, remote files
    └── utilities.ts       #  9 tools — activity types, currencies, field lists, lead labels/sources
```

---

## Development

```bash
# Start with auto-reload
deno task dev

# Start normally
deno task start
```

---

## License

[Apache License 2.0](LICENSE)
